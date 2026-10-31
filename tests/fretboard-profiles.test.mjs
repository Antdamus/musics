import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cleanData,mergeData} from '../fretboard/profile-data.mjs';
import {ProfileStore} from '../fretboard/profile-store.mjs';
const clone=x=>structuredClone(x);
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
function practice(base,hits=1){const d=clone(base),n=d.progress.notes[60]||{correct:0,attempts:0,last:0,passes:[]};n.correct+=hits;n.attempts+=hits;n.last+=100;d.progress.notes[60]=n;d.progress.positionUse['2:1']=(d.progress.positionUse['2:1']||0)+hits;return d;}
function backend(){
  const rows=new Map(),receipts=new Set();let loseReply=false,offline=false,conflict=false;
  return {
    rows,receipts,set loseReply(v){loseReply=v;},set offline(v){offline=v;},set conflict(v){conflict=v;},
    client(id){return {
      auth:{onAuthStateChange(){},async getSession(){return {data:{session:null}};}},
      from(){return {select(){return this;},eq(_,uid){this.uid=uid;return this;},maybeSingle(){return this;},async abortSignal(){return offline?{error:Error('Offline')}:{data:clone(rows.get(this.uid)||null)};}};},
      rpc(_,args){return {async abortSignal(){
        if(offline)return {error:Error('Offline')};
        if(args.expected_user_id!==id)return {error:{code:'PT403'}};
        const key=id+args.mutation_id,existing=rows.get(id);
        if(receipts.has(key))return {data:[clone(existing)]};
        if(conflict){conflict=false;const other=clone(existing);other.revision++;other.data=practice(other.data,3);rows.set(id,other);return {error:{code:'PT409'}};}
        if(existing&&args.expected_revision!==existing.revision)return {error:{code:'PT409'}};
        const row={user_id:id,username:args.profile_name,data:clone(args.profile_data),revision:(existing?.revision||0)+1};rows.set(id,row);receipts.add(key);
        if(loseReply){loseReply=false;return {error:Error('Reply lost after commit')};}
        return {data:[clone(row)]};
      }};}
    };}
  };
}
async function musician(t,server,id='alice',disk=storage(),options={}){
  const store=new ProfileStore({storage:disk,client:server.client(id),...options});
  t.after(()=>clearTimeout(store.timer));await store.switchUser({id,email:id+'@example.invalid',user_metadata:{username:id}});return store;
}

test('two devices merge new attempts, distinct settings, passes and sessions without double counting',()=>{
  const base=practice(cleanData(),5),phone=practice(base,2),computer=practice(base,3);
  phone.settings.bpm=35;computer.settings.targetBpm=120;
  phone.progress.notes[60].passes=[{id:'p1',at:1,bpm:100,duration:2,hits:2}];computer.progress.notes[60].passes=[{id:'p2',at:2,bpm:120,duration:2,hits:2}];
  phone.progress.sessions=[{id:'s1',at:1,ms:60000}];computer.progress.sessions=[{id:'s2',at:2,ms:120000}];
  const merged=mergeData(base,phone,computer);
  assert.equal(merged.progress.notes[60].correct,10);assert.equal(merged.progress.positionUse['2:1'],10);
  assert.equal(merged.settings.bpm,35);assert.equal(merged.settings.targetBpm,120);
  assert.equal(merged.progress.sessions.length,2);assert.equal(merged.progress.notes[60].passes.length,2);
  assert.deepEqual(mergeData(merged,merged,merged),merged);
});

test('reset on one device prevents stale offline practice from resurrecting cleared history',()=>{
  const base=practice(cleanData(),8),offline=practice(base,3),reset=cleanData();reset.progress.resetAt=1000;
  assert.deepEqual(mergeData(base,offline,reset).progress,reset.progress);
  assert.deepEqual(mergeData(base,reset,offline).progress,reset.progress);
});

test('stores on separate devices synchronize their additions and preserve account names',async t=>{
  const server=backend(),a=await musician(t,server),b=await musician(t,server);
  a.save(practice(a.viewData,2));b.save(practice(b.viewData,3));
  await a.sync();await b.sync();await a.sync();
  assert.equal(a.data.progress.notes[60].correct,5);assert.equal(b.data.progress.notes[60].correct,5);
  a.rename('Alice on guitar');await a.sync();const fresh=await musician(t,server);assert.equal(fresh.username,'Alice on guitar');
});

test('server revision conflicts refetch and merge without losing either device’s attempts',async t=>{
  const server=backend(),a=await musician(t,server);a.save(practice(a.viewData,2));server.conflict=true;
  await a.sync();assert.equal(a.data.progress.notes[60].correct,5);assert.equal(server.rows.get('alice').data.progress.notes[60].correct,5);
});

test('lost save reply survives reload and is retried exactly once using its receipt',async t=>{
  const server=backend(),disk=storage(),a=await musician(t,server,'alice',disk);
  a.save(practice(a.viewData,4));server.loseReply=true;assert.equal(await a.sync(),false);
  assert.ok(a.pendingWrite);assert.equal(server.rows.get('alice').data.progress.notes[60].correct,4);
  clearTimeout(a.timer);const reloaded=await musician(t,server,'alice',disk);
  assert.equal(reloaded.pendingWrite,null);assert.equal(reloaded.data.progress.notes[60].correct,4);
  assert.equal(server.rows.get('alice').data.progress.notes[60].correct,4);
});

test('offline saves remain separate from guest and another account, then sync after reconnect',async t=>{
  const server=backend(),disk=storage();disk.setItem('fretwise.v1',JSON.stringify(practice(cleanData(),8)));
  const a=await musician(t,server,'alice',disk);assert.deepEqual(a.data.progress.notes,{});
  server.offline=true;a.save(practice(a.viewData,2));assert.equal(await a.sync(),false);
  await a.switchUser(null);assert.equal(a.data.progress.notes[60].correct,8);
  a.client=server.client('bob');await a.switchUser({id:'bob',email:'bob@example.invalid'});assert.deepEqual(a.data.progress.notes,{});
  a.client=server.client('alice');server.offline=false;await a.switchUser({id:'alice',email:'alice@example.invalid'});
  assert.equal(a.data.progress.notes[60].correct,2);assert.equal(server.rows.get('alice').data.progress.notes[60].correct,2);
});

test('remote changes wait for pause while new local answers still merge into them',async t=>{
  const server=backend();let active=false;const a=await musician(t,server,'alice',storage(),{canApply:()=>!active}),b=await musician(t,server);
  active=true;b.save(practice(b.viewData,3));await b.sync();await a.sync();
  assert.deepEqual(a.viewData.progress.notes,{});assert.equal(a.data.progress.notes[60].correct,3);
  a.save(practice(a.viewData,2));await a.sync();assert.equal(a.data.progress.notes[60].correct,5);
  active=false;a.deliver();assert.equal(a.viewData.progress.notes[60].correct,5);
});

test('guest migration is explicit, preserves existing account progress, and cannot repeat',async t=>{
  const server=backend(),disk=storage();disk.setItem('fretwise.v1',JSON.stringify(practice(cleanData(),6)));
  const a=await musician(t,server,'alice',disk);a.save(practice(a.viewData,2));await a.sync();
  assert.equal(a.canImport(),true);await a.importGuest();assert.equal(a.data.progress.notes[60].correct,8);
  await a.importGuest();assert.equal(a.data.progress.notes[60].correct,8);assert.equal(a.canImport(),false);
  assert.equal(JSON.parse(disk.getItem('fretwise.v1')).progress.notes[60].correct,6);
});

test('guest import after a reset adds history without replacing account history or settings',async t=>{
  const server=backend(),disk=storage(),guest=practice(cleanData(),6);guest.progress.resetAt=2000;guest.settings.bpm=15;
  disk.setItem('fretwise.v1',JSON.stringify(guest));const a=await musician(t,server,'alice',disk);
  const own=practice(a.viewData,2);own.progress.resetAt=1000;own.settings.bpm=90;a.save(own);await a.sync();await a.importGuest();
  assert.equal(a.data.progress.notes[60].correct,8);assert.equal(a.data.progress.resetAt,1000);assert.equal(a.data.settings.bpm,90);
});

test('unavailable browser storage is reported instead of claiming a saved copy',()=>{
  const store=new ProfileStore({storage:{getItem:()=>null,setItem:()=>{throw Error('Full');}},client:{}});
  store.save(practice(store.viewData));assert.match(store.status,/storage unavailable/);assert.equal(store.data.progress.notes[60].correct,1);
});
