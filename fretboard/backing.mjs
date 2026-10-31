import {SCALES,TUNING,mod,spell} from './music.mjs?v=11';
import {guitarSample} from './guitar.mjs?v=1';
import {rumbaPhrase,fitRumbaBar} from './rumba-phrases.mjs?v=1';

export const recordedBacking=style=>['groove','nylon','duo','saxTrio','pianoDuo','electricRock','rumba'].includes(style);
// Scale-degree roots for four-bar vamps. The chord tones come from the scale itself.
const changes={major:[0,3,4,0],minor:[0,3,6,0],harmonicMinor:[0,3,4,0],dorian:[0,3,6,0],
  phrygian:[0,1,6,0],phrygianDominant:[0,1,6,0],mixolydian:[0,6,3,0]};
const rumbaChanges={minor:[0,6,5,4],harmonicMinor:[0,3,5,4],phrygian:[3,2,1,0],phrygianDominant:[3,6,1,0]};
export function progression(s){
  const intervals=SCALES[s.scale].intervals;
  let shapes;
  if(s.backing==='rumba'&&s.rumbaCadence){
    // In Phrygian practice the selected tonic is where the cadence resolves.
    const start=['phrygian','phrygianDominant'].includes(s.scale)?5:0;
    shapes=[[0,3,7],[10,14,17],[8,12,15],[7,11,14]].map(chord=>chord.map(n=>n+start));
  }else if(s.scale==='chromatic')shapes=Array.from({length:4},()=>[0,7]); // No implied major/minor third.
  else if(s.scale==='pentatonic')shapes=[[0,3,7],[5,10,0],[10,3,5],[0,3,7]];
  else{
    const degrees=(s.backing==='rumba'&&rumbaChanges[s.scale])||changes[s.scale];
    shapes=degrees.map(degree=>[0,2,4].map(n=>intervals[(degree+n)%7]));
  }
  return shapes.map(shape=>{
    const pcs=shape.map(n=>mod(s.root+n)),third=mod(pcs[1]-pcs[0]);
    const suffix=shape.length===2?'5':third===5?'sus4':third===3?'m':'';
    return {pcs,name:spell(60+pcs[0],s).name.replace(/-?\d+$/,'')+suffix};
  });
}
// Prefer a comfortable three-string fingering, accounting for open strings.
function voicing(pcs){
  const notes=pcs.length===2?[...pcs,pcs[0]]:pcs;let best,cost=Infinity;
  for(const low of [4,5,3])for(const a of [0,1,2])for(const b of [0,1,2]){
    if(a===b)continue;
    const grip=[a,b,3-a-b].map((n,i)=>{
      const string=low-i,open=TUNING[string-1],fret=mod(notes[n]-open);
      return {string,midi:open+fret,fret};
    });
    if(grip.some((n,i)=>i>0&&n.midi<=grip[i-1].midi))continue;
    const frets=grip.map(n=>n.fret).filter(Boolean),span=frets.length?Math.max(...frets)-Math.min(...frets):0;
    const weight=Math.max(...grip.map(n=>n.fret))+span*2+(span>4?35:0)+Math.abs(low-4)*.7;
    if(weight<cost){best=grip;cost=weight;}
  }
  return best;
}
const electricKeys=[40,41,45,48,50,52,55,59],violinKeys=[67,69,72,76,79];
const closest=(keys,midi)=>keys.reduce((best,key)=>Math.abs(key-midi)<Math.abs(best-midi)?key:best);

function addRockBar(beats,bar,bars,settings){
  const {pcs}=bars[bar],root=40+mod(pcs[0]-40),bass=root-12;
  const hasFifth=SCALES[settings.scale].intervals.includes(mod(pcs[0]+7-settings.root));
  const add=(instrument,native,midi,beat,offset,length,take,level,spread=0)=>{
    beats[bar*4+beat].push({midi,file:instrument+'/'+native+'-'+take+'.ogg',rate:2**((midi-native)/12),offset,length,level,spread});
  };
  const pick=(beat,offset,length,take,level)=>add('electric',closest(electricKeys,root),root,beat,offset,length,take,level);
  const strum=(beat,offset,length,take,level)=>{
    pick(beat,offset,length,take,level);
    if(hasFifth)add('electric',closest(electricKeys,root+7),root+7,beat,offset,length,take,level*.75,.009);
  };
  const pluck=(beat,offset,midi,length,take,level)=>add('rockbass',2*Math.round(midi/2),midi,beat,offset,length,take,level);
  // Longer chord accents alternate with short picked eighths. Let the final chord ring.
  strum(0,0,.86,1,.8);pick(1,0,.32,2,.6);pick(1,.5,.36,1,.65);
  strum(2,0,bar===3?1.8:.8,2,.87);
  if(bar<3){pick(3,0,.32,1,.59);strum(3,.5,.39,2,.66);}
  pluck(0,0,bass,1.36,1,.88);pluck(1,.5,bass,.4,2,.68);
  pluck(2,0,bass+(hasFifth&&bar<3?7:0),bar===3?1.8:1.25,2,.8);
  if(bar<3){
    // Before the last downbeat, outline the tonic chord's color (e.g. G versus G♯ over E).
    const next=bars[bar+1].pcs,pickup=next[bar===2?1:0];
    pluck(3,.5,28+mod(pickup-28),.43,1,.65);
  }
  if(settings.rockViolin&&bar%2===1){
    const target=67+mod(pcs[bar===3?0:1]-67);
    add('violin',closest(violinKeys,target),target,1,0,2.6,1,.78);
  }
}

const strumRoots={major:[0,2,4,7,9],minor:[2,4,9],sus4:[2,9],power:[2,9]};
// Direction, accent and ringing time in beats, counting 1 & 2 & 3 & 4 &.
const ventilador=[
  ['down',.94,.83],['brush',.62,.57],['down',.77,.70],['up',1.18,.5],
  ['mute',1,.5],['brush',.67,.58],['down',.91,.84],['brush',.73,.50]
];
function addRumbaBar(beats,bar,pcs,bpm){
  const phrase=rumbaPhrase(pcs,bpm);
  if(phrase){
    // Each beat can resume the same performance midway after a pause.
    for(let i=0;i<4;i++)beats[bar*4+i].push({...phrase,phraseBeat:i,offset:0,spread:0,length:4-i,level:1,release:.008});
    return;
  }
  const root=pcs[0],third=mod(pcs[1]-root);
  const quality=pcs.length===2?'power':third===3?'minor':third===5?'sus4':'major';
  const distance=native=>mod(root-native+6)-6;
  ventilador.forEach(([stroke,level,length],eighth)=>{
    const beat=beats[bar*4+Math.floor(eighth/2)],offset=(eighth%2)/2;
    const hit=(file,volume)=>beat.push({file:'rumba-guitar/'+file+'.ogg',rate:1,offset,length:.5,level:volume,spread:0});
    if(eighth===0)hit('body',.54);
    if(stroke==='mute'){hit(bar%2?'mute-low':'mute-mid',level);return;}
    // The fifth-only upstrokes use the three treble strings of C and G grips.
    const powerUp=quality==='power'&&stroke!=='down';
    const roots=powerUp?[0,7]:strumRoots[quality];
    const native=roots.reduce((best,n)=>Math.abs(distance(n))<Math.abs(distance(best))?n:best);
    const file=quality+'-'+native+'-'+(powerUp?'up':stroke)+'.ogg';
    beat.push({file:'rumba-guitar/'+file,rate:2**(distance(native)/12),offset,length,release:eighth===3?.014:.09,level,spread:0});
  });
}

export function arrangement(s){
  const bars=progression(s),beats=Array.from({length:16},()=>[]),tonic=36+s.root-(s.root>6?12:0);
  let previousKeys=null;
  bars.forEach(({pcs},bar)=>{
    if(s.backing==='rumba'){addRumbaBar(beats,bar,pcs,s.bpm);return;}
    const start=bar*4,root=tonic+mod(pcs[0]-s.root+5)-5;
    const bass=(beat,midi,length,level)=>{
      if(midi<29)midi+=12;
      const native=Math.max(30,Math.min(54,Math.round(midi/3)*3)),take=(bar+(beat===2?1:0))%2+1;
      beats[start+beat].push({midi,file:'bass/'+native+'-'+take+'.ogg',rate:2**((midi-native)/12),length,level,offset:0,spread:0});
    };
    if(s.backing==='electricRock')addRockBar(beats,bar,bars,s);
    else if(s.backing!=='nylon'){
      bass(0,root,1.65,.85);bass(2,root+mod(pcs.at(-1)-pcs[0]),bar%2?.78:1.65,.66);
      if(bar===1)bass(3,tonic+mod(bars[2].pcs[0]-s.root+5)-5,.72,.54);
      if(bar===3)bass(3,root+mod(pcs[1]-pcs[0]),.72,.54);
    }
    if(['nylon','duo','saxTrio'].includes(s.backing)){
      const grip=voicing(pcs);
      const pluck=(beat,voice,offset,length,level,spread=0)=>{
        const {midi,string}=grip[voice],sample=guitarSample({kind:'nylon',string,midi,layer:1});
        beats[start+beat].push({midi,file:'guitar/'+sample.file,rate:sample.rate,length,level,offset,spread});
      };
      pluck(0,0,0,1.8,1.05);pluck(1,1,0,1.45,.82);pluck(1,2,.5,1.1,.9);
      if(s.backing==='duo'||s.backing==='saxTrio')for(let i=0;i<3;i++)pluck(2,i,0,1.45,.66,.014*i);
      else pluck(2,0,0,1.7,.94);
      pluck(3,bar%2?1:2,0,.86,.83);
    }
    if(s.backing==='pianoDuo'||(s.backing==='electricRock'&&s.rockPiano)){
      // Keep common notes close between chords. The bass already supplies the root.
      const shapes=pcs.map((pc,i)=>{
        const low=53+mod(pc-53);
        return Array.from({length:pcs.length},(_,j)=>low+mod(pcs[(i+j)%pcs.length]-pc));
      });
      const motion=shape=>shape.reduce((sum,n,i)=>sum+Math.abs(n-(previousKeys?.[i]??(57+4*i))),0);
      const keys=shapes.sort((a,b)=>motion(a)-motion(b))[0];previousKeys=keys;
      const chord=(beat,offset,notes,length,level)=>notes.forEach((midi,i)=>{
        const native=Math.max(54,Math.min(74,2*Math.round(midi/2)));
        beats[start+beat].push({midi,file:'piano/'+native+'-1.ogg',rate:2**((midi-native)/12),
          offset,length,level:level*(i===notes.length-1?1:.85),spread:i*.008});
      });
      if(s.backing==='electricRock'){
        chord(0,.5,keys,bar===3?2.8:1.7,.46);
        if(bar<3)chord(2,.5,keys.slice(1),.92,.39);
      }else{
        chord(0,0,keys,bar===3?3.6:2.15,.75);
        if(bar<3)chord(2,.5,keys.slice(1),1.15,.55);
      }
    }
    if(s.backing==='saxTrio'&&bar%2===1){
      // A two-beat answer, resolving to the chord root. Leave the next bar to the player.
      const home=55+mod(pcs[0]-55),high=home+mod(pcs[1]-pcs[0]);
      let passing=high-1;
      while(passing>home&&!SCALES[s.scale].intervals.includes(mod(passing-s.root)))passing--;
      const sax=(beat,offset,midi,length,take,level)=>beats[start+beat].push({
        midi,file:'sax/'+midi+'-'+take+'.ogg',rate:1,length,level,offset,spread:0
      });
      sax(2,bar===1?0:.25,high,bar===1?.45:.65,1,.95);
      if(passing>home)sax(bar===1?2:3,bar===1?.5:0,passing,.4,2,.72);
      sax(3,bar===1?0:.5,home,bar===1?.82:.46,bar===1?1:2,.88);
    }
  });
  return beats;
}

function key(s){
  const options=s.backing==='electricRock'?[!!s.rockPiano,!!s.rockViolin]:s.backing==='rumba'?[!!s.rumbaCadence,s.bpm]:[];
  return [s.backing,s.root,s.scale,...options].join(':');
}
export class RecordedBacking{
  cache=new Map();pending=new Map();voices=new Set();plan=null;phraseUntil=0;
  constructor(context,destination){
    this.context=context;this.bus=context.createGain();
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=-9;compressor.ratio.value=3;compressor.knee.value=8;
    this.bus.connect(compressor);compressor.connect(destination);
  }
  setVolume(value){this.bus.gain.setTargetAtTime(value/100,this.context.currentTime,.016);}
  async load(file){
    if(this.cache.has(file))return this.cache.get(file);
    if(!this.pending.has(file)){
      const work=(async()=>{
        const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
        try{
          const response=await fetch(new URL('./samples/'+file,import.meta.url),{signal:ctl.signal});
          if(!response.ok)throw Error('Recording unavailable');
          const buffer=await this.context.decodeAudioData(await response.arrayBuffer());
          // Match attack levels gently so the backing leaves room for the player.
          const data=buffer.getChannelData(0),count=Math.min(data.length,Math.round(buffer.sampleRate*.22));
          let energy=0;for(let i=0;i<count;i++)energy+=data[i]*data[i];
          const bass=file.startsWith('bass/')||file.startsWith('rockbass/'),strum=/^rumba-guitar\/.*-(up|down|brush)\.ogg$/.test(file);
          const targetRms=strum||file.startsWith('rumba-phrases/') ? .15 : bass ? .14 : file.startsWith('sax/')||file.startsWith('violin/') ? .095 : .105;
          const trim=Math.min(bass?1.15:5,Math.max(.35,targetRms/Math.sqrt(energy/count||1)));
          const sample={buffer,trim};
          this.cache.set(file,sample);while(this.cache.size>36)this.cache.delete(this.cache.keys().next().value);
          return sample;
        }finally{clearTimeout(timer);this.pending.delete(file);}
      })();
      this.pending.set(file,work);
    }
    return this.pending.get(file);
  }
  async prepare(s,current){
    const id=key(s);if(this.plan?.id===id)return true;
    const beats=arrangement(s),files=[...new Set(beats.flat().map(e=>e.file))];
    const buffers=new Map(await Promise.all(files.map(async f=>[f,await this.load(f)])));
    if(!current())return false;
    const fitted=new Map();
    for(const event of beats.flat()){
      const original=buffers.get(event.file);
      event.sample=original;
      if(event.phraseBeat===undefined)continue;
      const take=event.file+'@'+event.rate;
      if(!fitted.has(take))fitted.set(take,{...original,buffer:fitRumbaBar(this.context,original.buffer,240*event.rate/s.bpm)});
      event.sample=fitted.get(take);
    }
    this.plan={id,beats};this.phraseUntil=0;return true;
  }
  beat(time,beat,s){
    if(beat<0||this.plan?.id!==key(s))return;
    const period=60/s.bpm;
    for(const event of this.plan.beats[beat%16]){
      if(event.phraseBeat>0&&this.phraseUntil>time+period*.5)continue;
      const src=this.context.createBufferSource(),env=this.context.createGain(),begin=time+event.offset*period+event.spread;
      const {buffer,trim}=event.sample,level=event.level*trim,startOffset=(event.phraseBeat||0)*period*event.rate;
      src.buffer=buffer;src.playbackRate.value=event.rate;
      const end=begin+Math.min(event.length*period,(buffer.duration-startOffset)/event.rate),release=Math.min(event.release??.13,(end-begin)*.25);
      if(event.phraseBeat!==undefined)this.phraseUntil=end;
      env.gain.setValueAtTime(0,begin);env.gain.linearRampToValueAtTime(level,begin+.003);
      env.gain.setValueAtTime(level,end-release);env.gain.linearRampToValueAtTime(0,end);
      src.connect(env);env.connect(this.bus);const voice={src,env};this.voices.add(voice);
      src.onended=()=>{this.voices.delete(voice);src.disconnect();env.disconnect();};
      src.start(begin,startOffset);src.stop(end+.002);
    }
  }
  stop(){
    this.phraseUntil=0;
    const now=this.context.currentTime;
    for(const {src,env} of this.voices){
      env.gain.cancelAndHoldAtTime?.(now);
      if(!env.gain.cancelAndHoldAtTime){env.gain.cancelScheduledValues(now);env.gain.setValueAtTime(0,now);}
      env.gain.linearRampToValueAtTime(0,now+.016);src.stop(now+.018);
    }
  }
}
