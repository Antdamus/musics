// Download the credited CC0 performances and retain the attack and first seconds of decay.
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
const run=promisify(execFile),hash=data=>createHash('sha256').update(data).digest('hex');
const out=new URL('../fretboard/samples/rumba-guitar/',import.meta.url),temp=new URL('../test-results/rumba-guitar-source/',import.meta.url);
await Promise.all([out,temp].map(dir=>mkdir(dir,{recursive:true})));
const sources=[];
function add(name,id,author='SpeedY',user=6479){
  sources.push({name,id,author,page:`https://freesound.org/people/${author}/sounds/${id}/`,
    source:`https://cdn.freesound.org/previews/${Math.floor(id/1000)}/${id}_${user}-hq.mp3`});
}
for(const [quality,root,down,up,brush] of [
  ['major',0,8468,8469,8471],['major',2,8476,8477,8478],['major',4,8489,8490,8491],['major',7,8499,8500,8502],['major',9,8449,8450,8451],
  ['minor',2,8482,8483,8484],['minor',4,8492,8493,8494],['minor',9,8455,8456,8457],
  ['sus4',2,8485,8486,8487],['sus4',9,8458,8459,8460],['power',2,8475],['power',9,8448]
]){
  add(`${quality}-${root}-down`,down);
  if(up)add(`${quality}-${root}-up`,up);
  if(brush)add(`${quality}-${root}-brush`,brush);
}
// Three treble strings voiced G-C-G and G-D-G respectively.
add('power-0-up',8464);add('power-7-up',8498);
add('mute-mid',8506);add('mute-low',8505);add('body',674811,'leaving.february',14339611);
async function prepare({name,id,author,page,source}){
  const input=new URL(id+'.mp3',temp),file=name+'.ogg',output=new URL(file,out);
  if(!process.argv.includes('--cached'))await run('curl',['-fsSL','--retry','4','--retry-all-errors','--max-time','45',source,'-o',fileURLToPath(input)],{windowsHide:true});
  const percussive=name==='body'||name.startsWith('mute-');
  const duration=percussive ? .22 : 3,fade=percussive ? .035 : .15;
  // Some takes have audible finger movement well before the chord. Align the first string attack.
  const onset=percussive?'start_threshold=-45dB:start_silence=0.003':'start_threshold=-26dB:start_silence=0.008';
  const filters=`silenceremove=start_periods=1:${onset}:start_duration=0.002:window=0.005,atrim=duration=${duration},afade=t=out:st=${duration-fade}:d=${fade}`;
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',fileURLToPath(input),'-map_metadata','-1','-af',filters,'-c:a','libvorbis','-q:a','6',fileURLToPath(output)],{windowsHide:true});
  return {file,id,author,page,source,originalSha256:hash(await readFile(input)),sha256:hash(await readFile(output))};
}
const samples=[];
for(let i=0;i<sources.length;i+=3)samples.push(...await Promise.all(sources.slice(i,i+3).map(prepare)));
await writeFile(new URL('sources.json',out),JSON.stringify({license:'CC0-1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',samples},null,2)+'\n');
console.log('Prepared '+samples.length+' guitar recordings.');
