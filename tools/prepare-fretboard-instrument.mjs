// Rebuild one stage instrument: node tools/prepare-fretboard-instrument.mjs sax|piano
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),instrument=process.argv[2];
if(!['sax','piano'].includes(instrument))throw Error('Choose sax or piano.');
const sax=instrument==='sax',revision=sax?'a4d756b21d2a573aca0d840cce7e71ba5effd4c6':'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e';
const base='https://raw.githubusercontent.com/'+(sax?'sfzinstruments/karoryfer.weresax':'sgossner/VCSL')+'/'+revision+'/';
const url=path=>base+path.split('/').map(encodeURIComponent).join('/');
const out=new URL('../fretboard/samples/'+instrument+'/',import.meta.url),temp=new URL('../test-results/'+instrument+'-source/',import.meta.url);
await Promise.all([out,temp].map(dir=>mkdir(dir,{recursive:true})));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fetchFile(path,dest){
  await run('curl',['-fsSL','--retry','5','--retry-all-errors','--max-time','45',url(path),'-o',fileURLToPath(dest)],{windowsHide:true});
  return readFile(dest);
}
const mapping='Programs/alto_map_piano_condenser.sfz',regions=[];
if(sax){
  const sfz=await fetchFile(mapping,new URL('map.sfz',temp));
  for(const region of sfz.toString().split('<region>').slice(1)){
    const midi=Number(region.match(/pitch_keycenter=(\d+)/)?.[1]??60);if(midi<55||midi>73)continue;
    const name=region.match(/sample=.*?([a-g]b?\d+_p_rr([12])_cnd\.wav)/);if(!name)throw Error('Unknown region');
    regions.push({midi,take:Number(name[2]),source:'Samples/alto/'+name[1]});
  }
  if(regions.length!==38)throw Error('Unexpected publisher mapping');
}else{
  for(let midi=54;midi<=74;midi+=2){
    const note=['C','D','E','F#','G#','A#'][midi%12/2]+(Math.floor(midi/12)-1);
    regions.push({midi,take:1,source:'Chordophones/Zithers/Grand Piano, Steinway B/Sus/JHPiano_Sus_Close_'+note+'_vl2_rr1.wav'});
  }
}
const samples=[];
async function prepare({midi,take,source}){
  const file=midi+'-'+take+'.ogg',raw=new URL(file+'.wav',temp),original=await fetchFile(source,raw),dest=new URL(file,out);
  if(original.toString('ascii',0,4)!=='RIFF')throw Error('Not a WAV file: '+source);
  const filters='silenceremove=start_periods=1:start_threshold=-64dB:start_silence=0.003'+(sax?'':',atrim=duration=8,afade=t=out:st=7.5:d=0.5');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',fileURLToPath(raw),'-map_metadata','-1','-af',filters,'-c:a','libvorbis','-q:a','6',fileURLToPath(dest)],{windowsHide:true});
  const encoded=await readFile(dest);samples.push({midi,take,file,bytes:encoded.length,sha256:hash(encoded),source:url(source),originalSha256:hash(original)});
}
for(let i=0;i<regions.length;i+=3)await Promise.all(regions.slice(i,i+3).map(prepare));
await fetchFile('LICENSE',new URL('LICENSE.txt',out));
samples.sort((a,b)=>a.midi-b.midi||a.take-b.take);
await writeFile(new URL('sources.json',out),JSON.stringify({library:sax?'Karoryfer Weresax':'Versilian Community Sample Library · Steinway B',license:'CC0-1.0',revision,...(sax?{mapping:url(mapping)}:{}),samples},null,2)+'\n');
console.log(samples.length+' '+instrument+' recordings; '+samples.reduce((n,s)=>n+s.bytes,0)+' bytes');
