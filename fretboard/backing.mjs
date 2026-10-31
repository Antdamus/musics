import {SCALES,TUNING,mod,spell} from './music.mjs?v=7';
import {guitarSample} from './guitar.mjs?v=1';

export const recordedBacking=style=>['groove','nylon','duo'].includes(style);
// Scale-degree roots for four-bar vamps. The chord tones come from the scale itself.
const changes={major:[0,3,4,0],minor:[0,3,6,0],harmonicMinor:[0,3,4,0],dorian:[0,3,6,0],
  phrygian:[0,1,6,0],phrygianDominant:[0,1,6,0],mixolydian:[0,6,3,0]};
export function progression(s){
  const intervals=SCALES[s.scale].intervals;
  let shapes;
  if(s.scale==='chromatic')shapes=Array.from({length:4},()=>[0,7]); // No implied major/minor third.
  else if(s.scale==='pentatonic')shapes=[[0,3,7],[5,10,0],[10,3,5],[0,3,7]];
  else shapes=changes[s.scale].map(degree=>[0,2,4].map(n=>intervals[(degree+n)%7]));
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
export function arrangement(s){
  const bars=progression(s),beats=Array.from({length:16},()=>[]),tonic=36+s.root-(s.root>6?12:0);
  bars.forEach(({pcs},bar)=>{
    const start=bar*4,root=tonic+mod(pcs[0]-s.root+5)-5,grip=voicing(pcs);
    const bass=(beat,midi,length,level)=>{
      if(midi<29)midi+=12;
      const native=Math.max(30,Math.min(54,Math.round(midi/3)*3)),take=(bar+(beat===2?1:0))%2+1;
      beats[start+beat].push({midi,file:'bass/'+native+'-'+take+'.ogg',rate:2**((midi-native)/12),length,level,offset:0,spread:0});
    };
    if(s.backing!=='nylon'){
      bass(0,root,1.65,.85);bass(2,root+mod(pcs.at(-1)-pcs[0]),bar%2?.78:1.65,.66);
      if(bar===1)bass(3,tonic+mod(bars[2].pcs[0]-s.root+5)-5,.72,.54);
      if(bar===3)bass(3,root+mod(pcs[1]-pcs[0]),.72,.54);
    }
    if(s.backing!=='groove'){
      const pluck=(beat,voice,offset,length,level,spread=0)=>{
        const {midi,string}=grip[voice],sample=guitarSample({kind:'nylon',string,midi,layer:1});
        beats[start+beat].push({midi,file:'guitar/'+sample.file,rate:sample.rate,length,level,offset,spread});
      };
      pluck(0,0,0,1.8,1.05);pluck(1,1,0,1.45,.82);pluck(1,2,.5,1.1,.9);
      if(s.backing==='duo')for(let i=0;i<3;i++)pluck(2,i,0,1.45,.66,.014*i);
      else pluck(2,0,0,1.7,.94);
      pluck(3,bar%2?1:2,0,.86,.83);
    }
  });
  return beats;
}

const key=s=>[s.backing,s.root,s.scale].join(':');
export class RecordedBacking{
  cache=new Map();pending=new Map();voices=new Set();plan=null;
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
          // Match attack levels gently: the two instruments were recorded at different gains.
          const data=buffer.getChannelData(0),count=Math.min(data.length,Math.round(buffer.sampleRate*.22));
          let energy=0;for(let i=0;i<count;i++)energy+=data[i]*data[i];
          const bass=file.startsWith('bass/'),targetRms=bass ? .14 : .105;
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
    this.plan={id,beats,buffers};return true;
  }
  beat(time,beat,s){
    if(beat<0||this.plan?.id!==key(s))return;
    const period=60/s.bpm;
    for(const event of this.plan.beats[beat%16]){
      const src=this.context.createBufferSource(),env=this.context.createGain(),begin=time+event.offset*period+event.spread;
      const {buffer,trim}=this.plan.buffers.get(event.file),level=event.level*trim;
      src.buffer=buffer;src.playbackRate.value=event.rate;
      const end=begin+Math.min(event.length*period,src.buffer.duration/event.rate),release=Math.min(.13,(end-begin)*.25);
      env.gain.setValueAtTime(0,begin);env.gain.linearRampToValueAtTime(level,begin+.003);
      env.gain.setValueAtTime(level,end-release);env.gain.linearRampToValueAtTime(0,end);
      src.connect(env);env.connect(this.bus);const voice={src,env};this.voices.add(voice);
      src.onended=()=>{this.voices.delete(voice);src.disconnect();env.disconnect();};
      src.start(begin);src.stop(end+.002);
    }
  }
  stop(){
    const now=this.context.currentTime;
    for(const {src,env} of this.voices){
      env.gain.cancelAndHoldAtTime?.(now);
      if(!env.gain.cancelAndHoldAtTime){env.gain.cancelScheduledValues(now);env.gain.setValueAtTime(0,now);}
      env.gain.linearRampToValueAtTime(0,now+.016);src.stop(now+.018);
    }
  }
}
