export const phraseTempos=[48,72,100,132,172];

export function rumbaPhrase(pcs,bpm){
  if(bpm<40||!Number.isFinite(bpm)||pcs.length!==3)return null;
  const [root,third,fifth]=pcs,interval=(third-root+12)%12;
  if((fifth-root+12)%12!==7||![3,4].includes(interval))return null;
  const quality=interval===3?'minor':'major',original=interval===3?7:8;
  // Three transposed takes per quality keep the final shift within two semitones.
  const shift=((root-original+14)%4)-2,native=(root-shift+12)%12,rate=2**(shift/12);
  const target=bpm/rate;
  const tempo=phraseTempos.reduce((best,n)=>Math.abs(Math.log(n/target))<Math.abs(Math.log(best/target))?n:best);
  return {file:'rumba-phrases/'+quality+'-'+native+'-'+tempo+'.ogg',rate};
}

// Match nearby wave cycles before overlapping windows. Both stereo channels follow the
// same splice positions so small tempo adjustments preserve the guitar's pitch and image.
export function fitRumbaBar(context,source,seconds){
  const sr=source.sampleRate,size=Math.round(sr*seconds);
  if(Math.abs(source.length-size)<=1)return source;
  const out=context.createBuffer(source.numberOfChannels,size,sr);
  const input=Array.from({length:source.numberOfChannels},(_,i)=>source.getChannelData(i));
  const output=input.map((_,i)=>out.getChannelData(i));
  const overlap=Math.round(sr*.018),hop=Math.round(sr*.034),window=hop+overlap,search=Math.round(sr*.012);
  let previous=0;
  for(let dest=0;dest<size;dest+=hop){
    const count=Math.min(window,size-dest);
    const nominal=Math.round(dest*(source.length-window)/(size-window));
    let start=Math.max(0,Math.min(nominal,source.length-count));
    if(dest>0){
      const lo=Math.max(0,start-search),hi=Math.min(source.length-count,start+search);
      let best=-Infinity;
      for(let candidate=lo;candidate<=hi;candidate+=4){
        let dot=0,energy=0;
        for(let j=0;j<Math.min(overlap,count);j+=8){
          const sample=input[0][candidate+j];
          dot+=input[0][previous+hop+j]*sample;energy+=sample*sample;
        }
        const score=dot/Math.sqrt(energy+1e-10);
        if(score>best){best=score;start=candidate;}
      }
    }
    for(let ch=0;ch<input.length;ch++){
      const mix=dest?Math.min(overlap,count):0;
      for(let j=0;j<mix;j++)output[ch][dest+j]+=(input[ch][start+j]-output[ch][dest+j])*j/overlap;
      output[ch].set(input[ch].subarray(start+mix,start+count),dest+mix);
    }
    previous=start;
  }
  return out;
}
