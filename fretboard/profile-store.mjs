import {cleanData,mergeData,same,hasPractice} from './profile-data.mjs?v=6';

export const GUEST_KEY='fretwise.v1';
const copy=value=>structuredClone(value);
export class ProfileStore {
  constructor({storage,client,onData=()=>{},onStatus=()=>{},canApply=()=>true,beforeSwitch=()=>{},onRecovery=()=>{}}){
    Object.assign(this,{storage,client,onData,onStatus,canApply,beforeSwitch,onRecovery});
    this.user=null;this.username='Guest';this.baseName='';this.revision=0;
    this.data=cleanData(this.read(GUEST_KEY));this.viewData=copy(this.data);this.base=cleanData();
    this.pendingWrite=null;this.inflight=null;this.timer=0;this.status='Saved on this browser';this.loaded=false;
    this.transitions=Promise.resolve();
  }
  read(key){try{return JSON.parse(this.storage.getItem(key)||'null');}catch{return null;}}
  write(key,value){try{this.storage.setItem(key,JSON.stringify(value));this.storageAvailable=true;return true;}catch{this.storageAvailable=false;this.status='Device storage unavailable — keep this page open';this.emit();return false;}}
  get cacheKey(){return `fretwise.profile.${this.user?.id}`;}
  cache(){
    if(!this.user)return this.write(GUEST_KEY,this.data);
    return this.write(this.cacheKey,{data:this.data,base:this.base,username:this.username,baseName:this.baseName,revision:this.revision,pendingWrite:this.pendingWrite});
  }
  emit(){this.onStatus({user:this.user,username:this.username,status:this.status,loaded:this.loaded,canImport:this.canImport()});}
  deliver(force=false){
    if(!force&&!this.canApply())return;
    if(force||!same(this.viewData,this.data)){this.viewData=copy(this.data);this.onData(copy(this.data),{switching:force});}
  }
  save(value){
    // The score may still be playing from an older view while a remote save arrives.
    // Apply just its new work, preserving the remote progress until the next pause.
    this.data=mergeData(this.viewData,value,this.data);this.viewData=cleanData(value);
    if(!this.cache())return;
    if(this.user){this.status='Saving progress…';this.schedule();}else this.status='Saved on this browser';
    this.emit();
  }
  schedule(delay=700){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.sync(),delay);}
  async init(){
    this.client.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY')queueMicrotask(()=>this.onRecovery());
      if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event))queueMicrotask(()=>void this.switchUser(session?.user||null));
    });
    const {data,error}=await this.client.auth.getSession();
    if(error){this.status='Sign in to reconnect your account';this.loaded=true;this.emit();return;}
    await this.switchUser(data.session?.user||null);
    this.loaded=true;this.emit();
  }
  switchUser(user){
    this.transitions=this.transitions.catch(()=>{}).then(async()=>{
      if((this.user?.id||null)===(user?.id||null)){this.user=user;this.emit();return;}
      await this.beforeSwitch();
      clearTimeout(this.timer);if(this.inflight)await this.inflight;
      this.cache();this.user=user;this.pendingWrite=null;
      if(user){
        const cached=this.read(this.cacheKey)||{};
        this.data=cleanData(cached.data);this.base=cleanData(cached.base);this.revision=Number(cached.revision)||0;
        this.username=String(cached.username||user.user_metadata?.username||'Guitarist').slice(0,32);
        this.baseName=cached.baseName??this.username;this.pendingWrite=cached.pendingWrite||null;this.status='Connecting your progress…';
      }else{
        this.data=cleanData(this.read(GUEST_KEY));this.base=cleanData();this.revision=0;this.username='Guest';this.baseName='';this.status='Saved on this browser';
      }
      this.deliver(true);this.emit();
      if(user)await this.sync();
    });
    return this.transitions;
  }
  async sync(){
    clearTimeout(this.timer);
    if(this.inflight)return this.inflight;
    if(!this.user)return true;
    this.inflight=this.syncWork().finally(()=>{this.inflight=null;});
    return this.inflight;
  }
  async sendPending(){
    const write=copy(this.pendingWrite);
    const {data,error}=await this.client.rpc('save_practice_profile',{
      expected_revision:write.revision,profile_name:write.username,profile_data:write.data,mutation_id:write.id,expected_user_id:this.user.id
    }).abortSignal(AbortSignal.timeout(15000));
    if(error){
      if(error.code==='PT409'){this.pendingWrite=null;this.cache();return false;}
      throw error;
    }
    const row=data?.[0];if(!row)throw Error('No save confirmation');
    this.data=mergeData(write.data,this.data,row.data);
    if(this.username===write.username)this.username=row.username;
    this.base=cleanData(row.data);this.baseName=row.username;this.revision=row.revision;this.pendingWrite=null;
    this.cache();this.deliver();return true;
  }
  async syncWork(){
    this.status='Syncing…';this.emit();
    try{
      // Retry the same receipt after a network failure, even following a reload.
      if(this.pendingWrite)await this.sendPending();
      for(let attempt=0;attempt<5;attempt++){
        const {data:row,error}=await this.client.from('practice_profiles').select('*').eq('user_id',this.user.id).maybeSingle().abortSignal(AbortSignal.timeout(15000));
        if(error)throw error;
        const remote=cleanData(row?.data);
        this.data=mergeData(this.base,this.data,remote);
        if(this.username===this.baseName&&row)this.username=row.username;
        this.base=remote;this.baseName=row?.username||'';this.revision=row?.revision||0;
        this.cache();this.deliver();
        if(row&&same(this.data,remote)&&this.username===row.username){this.status='Synced across devices';this.emit();return true;}
        this.pendingWrite={id:crypto.randomUUID(),revision:this.revision,username:this.username,data:copy(this.data)};
        if(!this.cache())throw Error('Cannot safely queue a cloud save');
        if(!await this.sendPending())continue;
        if(same(this.data,this.base)&&this.username===this.baseName){this.status='Synced across devices';this.emit();return true;}
      }
      this.status='Saved here · another device is updating';this.schedule(3000);this.emit();return false;
    }catch(error){
      this.status=this.storageAvailable===false?'Device storage unavailable — keep this page open':error.status===401||error.code==='PGRST301'?'Sign in again to sync · progress saved here':'Saved here · waiting to sync';
      this.emit();return false;
    }
  }
  rename(name){this.username=name.trim().slice(0,32)||'Guitarist';this.cache();this.schedule(0);this.emit();}
  canImport(){
    if(!this.user)return false;
    const guest=this.read(GUEST_KEY),id=this.read('fretwise.guest-id');
    return hasPractice(guest)&&(!id||!this.data.progress.imports.includes(id))&&!this.read('fretwise.guest-claimed');
  }
  async importGuest(){
    if(!await this.sync())throw Error('Connect and sync your account before importing.');
    if(!this.canImport())return;
    let id=this.read('fretwise.guest-id');if(!id){id=crypto.randomUUID();this.write('fretwise.guest-id',id);}
    const guest=cleanData(this.read(GUEST_KEY)),base=cleanData();
    // Import is additive even if either history was reset before the import.
    guest.progress.resetAt=base.progress.resetAt=this.data.progress.resetAt;
    guest.settings=base.settings=copy(this.data.settings);
    this.data=mergeData(base,guest,this.data);
    this.data.progress.imports.push(id);this.cache();this.deliver();
    this.write('fretwise.guest-claimed',this.user.id);this.emit();await this.sync();
  }
  async signOut(){
    await this.beforeSwitch();await this.sync();
    const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw error;
    await this.switchUser(null);
  }
}
