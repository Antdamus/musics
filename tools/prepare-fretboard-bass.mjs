// Prepare the recorded upright bass for the web player. Requires Node, curl and ffmpeg.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const revision='ac9e859564bda286ab5ec672d00ff1aa2fef2895';
const base='https://raw.githubusercontent.com/sfzinstruments/karoryfer.meatbass/'+revision+'/';
const out=new URL('../fretboard/samples/bass/',import.meta.url),temp=new URL('../test-results/bass-source/',import.meta.url);
await Promise.all([out,temp].map(dir=>mkdir(dir,{recursive:true})));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function download(path){
  const res=spawnSync('curl',['-fsSL','--retry','5','--retry-all-errors','--max-time','45',base+path],{windowsHide:true,maxBuffer:12*1024*1024});
  if(res.status!==0)throw Error(res.stderr?.toString()||res.error?.message);
  return res.stdout;
}
const samples=[];
for(let midi=30;midi<=54;midi+=3)for(const take of [1,2]){
  const pitch=({0:'c',3:'eb',6:'gb',9:'a'})[midi%12]+(Math.floor(midi/12)-1);
  const source='Samples/pizz/'+pitch+'_vl3_rr'+take+'.wav',file=midi+'-'+take+'.ogg';
  const original=await download(source),wav=fileURLToPath(new URL(file+'.wav',temp));await writeFile(wav,original);
  const ff=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-map_metadata','-1','-af','silenceremove=start_periods=1:start_threshold=-64dB:start_silence=0.002','-c:a','libvorbis','-q:a','6',fileURLToPath(new URL(file,out))],{encoding:'utf8',windowsHide:true});
  if(ff.status!==0)throw Error(ff.stderr||ff.error?.message);
  const encoded=await readFile(new URL(file,out));samples.push({midi,take,file,bytes:encoded.length,sha256:hash(encoded),source:base+source,originalSha256:hash(original)});
}
await writeFile(new URL('LICENSE.txt',out),await download('LICENSE'));
await writeFile(new URL('sources.json',out),JSON.stringify({library:'Karoryfer Meatbass',revision,license:'CC0-1.0',samples},null,2)+'\n');
console.log(samples.length+' bass recordings, '+samples.reduce((n,s)=>n+s.bytes,0)+' bytes');
