// A compact acoustic kit made from recorded hits, not synthesized percussion.
export const DRUM_STYLES=['off','pop','rock','shuffle','halftime','rumba'];
const acousticPieces=['kick','snare','hat','openhat','tomhi','tommid','tomlow','ride','crash'];
export const DRUM_FILES=acousticPieces.flatMap(piece=>(['kick','snare','hat'].includes(piece)?['soft','hard']:['hard']).flatMap(layer=>[1,2].map(rr=>`${piece}-${layer}-${rr}.wav`)));
const rumbaSounds={cajonLow:[50,3],cajonTap:[48,3],cajonSlap:[49,2],palmas:[59,4]};
export const DRUM_PIECES=[...acousticPieces,...Object.keys(rumbaSounds)];
export const RUMBA_FILES=Object.values(rumbaSounds).flatMap(([key,takes])=>Array.from({length:takes},(_,i)=>key+'-'+(i+1)+'.ogg'));
export const drumBank=style=>style==='rumba'?'rumba':'acoustic';

// Offsets are in beats: changing tempo changes spacing, never sample pitch.
export function drumHits(beat,style='pop',fills=true){
  if(beat<0||!DRUM_STYLES.includes(style)||style==='off')return [];
  const b=beat%4,phrase=beat%16,hits=[];
  const add=(piece,offset,velocity)=>hits.push({piece,offset,velocity});
  if(style==='rumba'){
    // Low on one, anticipate four on the "and" of three. Palmas leave the downbeat open.
    if(b===0)add('cajonLow',0,.73);
    if(b===1||b===3){add('cajonSlap',0,.53);add('palmas',0,b===3?.61:.52);}
    if(b===1)add('palmas',.5,.35);
    if(b===2){add('palmas',0,.45);add('cajonLow',.5,.63);}
    if(b===0&&phrase%8===4)add('cajonTap',.5,.24);
    if(fills&&phrase===15){add('cajonTap',.5,.32);add('cajonSlap',.75,.4);}
    return hits;
  }
  if(b===0||b===2&&style!=='halftime')add('kick',0,style==='rock'?.95:.82);
  if(style==='halftime'&&b===3)add('kick',.5,.65);
  if(style==='rock'&&b===2||style==='pop'&&phrase===6)add('kick',.5,.72);
  if(fills&&phrase===0)add('crash',0,.72);
  if(fills&&phrase>=14){
    if(phrase===14){add('snare',0,.78);add('tomhi',.5,.72);add('tomhi',.75,.85);}
    else{add('tommid',0,.82);add('tommid',.25,.7);add('tomlow',.5,.85);add('tomlow',.75,.95);}
  }else{
    if(style==='halftime'?b===2:b===1||b===3)add('snare',0,style==='rock'?.96:.82);
    const cymbal=style==='shuffle'?'ride':'hat';
    add(cymbal,0,b%2===0?.78:.66);
    add(style==='rock'&&b===3?'openhat':cymbal,style==='shuffle'?2/3:.5,.48);
    if(style==='pop'&&phrase===11)add('snare',.75,.35);
  }
  return hits.sort((a,b)=>a.offset-b.offset);
}

export class AcousticKit {
  buffers=new Map();voices=new Set();roundRobin=new Map();loading=new Map();loaded=new Set();
  constructor(context,destination){
    this.context=context;this.bus=context.createGain();this.bus.gain.value=.65;
    // Gentle peak control leaves the acoustic decay and stereo room intact.
    this.compressor=context.createDynamicsCompressor();this.compressor.threshold.value=-10;this.compressor.knee.value=10;this.compressor.ratio.value=3;this.compressor.attack.value=.003;this.compressor.release.value=.15;
    this.bus.connect(this.compressor);this.compressor.connect(destination);
  }
  setVolume(value){this.bus.gain.setTargetAtTime(value/100,this.context.currentTime,.015);}
  async load(style='pop'){
    const bank=drumBank(style);
    if(this.loaded.has(bank))return;
    if(this.loading.has(bank))return this.loading.get(bank);
    const work=(async()=>{
      const files=bank==='rumba'?RUMBA_FILES:DRUM_FILES;
      const queue=files.filter(file=>!this.buffers.has(file)),controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),30000);
      try{
        const results=await Promise.allSettled(Array.from({length:4},async()=>{
          try{while(queue.length){
            const file=queue.shift(),response=await fetch(new URL(`./samples/${bank}/${file}`,import.meta.url),{signal:controller.signal});
            if(!response.ok)throw Error(`Could not load ${file}`);
            const buffer=await this.context.decodeAudioData(await response.arrayBuffer());this.buffers.set(file,buffer);
          }}catch(error){controller.abort();throw error;}
        }));
        if(results.some(r=>r.status==='rejected'))throw Error('The acoustic kit could not load. Retry, or choose Drums off to keep practicing.');
        this.loaded.add(bank);
      }finally{clearTimeout(timeout);}
    })();
    this.loading.set(bank,work);
    try{await work;}finally{this.loading.delete(bank);}
  }
  hit(piece,time,velocity=.8){
    const rumba=rumbaSounds[piece];
    if(!this.loaded.has(rumba?'rumba':'acoustic'))return;
    const layer=velocity<.67&&['kick','snare','hat'].includes(piece)?'soft':'hard',key=rumba?String(rumba[0]):`${piece}-${layer}`;
    const rr=(this.roundRobin.get(key)||0)%(rumba?rumba[1]:2)+1;this.roundRobin.set(key,rr);
    const buffer=this.buffers.get(`${key}-${rr}.${rumba?'ogg':'wav'}`);if(!buffer)return;
    const context=this.context,source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
    // Different takes + restrained touch variation. Beat onsets stay exact.
    const level=velocity*(.96+Math.random()*.08);gain.gain.setValueAtTime(level,time);
    if(piece==='hat'||piece==='openhat')for(const voice of this.voices){
      if((voice.piece==='hat'||voice.piece==='openhat')&&voice.time<=time&&(!voice.chokedAt||time<voice.chokedAt)){
        voice.chokedAt=time;
        voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setValueAtTime(voice.level,time);voice.gain.gain.linearRampToValueAtTime(0,time+.018);voice.source.stop(time+.02);
      }
    }
    source.connect(gain);gain.connect(this.bus);
    const voice={source,gain,piece,time,level};this.voices.add(voice);
    source.onended=()=>{this.voices.delete(voice);source.disconnect();gain.disconnect();};source.start(time);
  }
  beat(time,beat,settings){
    this.setVolume(settings.drumVolume);
    for(const hit of drumHits(beat,settings.drums,settings.drumFills))this.hit(hit.piece,time+hit.offset*60/settings.bpm,hit.velocity);
  }
  stop(){
    const now=this.context.currentTime;
    for(const voice of this.voices){try{
      voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(voice.time>now?0:voice.level,now);voice.gain.gain.linearRampToValueAtTime(0,now+.01);voice.source.stop(now+.012);
    }catch{}}
    this.voices.clear();
  }
}
