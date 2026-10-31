// Rebuild the licensed, continuously played bars with FFmpeg and its Rubber Band filter.
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {phraseTempos} from '../fretboard/rumba-phrases.mjs';

const run=promisify(execFile),hash=data=>createHash('sha256').update(data).digest('hex');
const out=new URL('../fretboard/samples/rumba-phrases/',import.meta.url),cache=new URL('../test-results/',import.meta.url);
await Promise.all([out,cache].map(dir=>mkdir(dir,{recursive:true})));
const sources=[],samples=[];
for(const [quality,root,id,title,seconds,cents] of [
  ['minor',7,41986,'Flamenco Loop 3.wav',1.996,12],['major',8,41989,'Flamenco Loop 6.wav',1.985,3]
]){
  const source='https://cdn.freesound.org/previews/41/'+id+'_29541-hq.mp3',input=fileURLToPath(new URL('rumba-'+id+'.mp3',cache));
  if(!process.argv.includes('--cached'))await run('curl',['-fsSL','--retry','3',source,'-o',input],{windowsHide:true});
  sources.push({title,author:'digifishmusic',page:'https://freesound.org/people/digifishmusic/sounds/'+id+'/',source,sha256:hash(await readFile(input)),start:0,seconds,quality,root,cents});
  for(const shift of [-4,0,4])for(const bpm of phraseTempos){
    const pc=(root+shift+12)%12,bar=240/bpm,file=quality+'-'+pc+'-'+bpm+'.ogg';
    const frames=Math.round(44100*seconds),pitch=2**((shift+cents/100)/12);
    // Stretch three adjacent copies and take the middle one to keep processing edges outside the bar.
    const filters=['aresample=44100','atrim=end_sample='+frames,'aloop=loop=2:size='+frames,
      'rubberband=tempo='+seconds/bar+':pitch='+pitch+':transients=crisp:channels=together',
      'atrim=start='+bar+':duration='+bar,'asetpts=PTS-STARTPTS'].join(',');
    const dest=fileURLToPath(new URL(file,out));
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-map_metadata','-1','-af',filters,'-fflags','+bitexact','-c:a','libvorbis','-q:a','5',dest],{windowsHide:true});
    samples.push({file,id,sha256:hash(await readFile(dest))});
  }
}
await writeFile(new URL('sources.json',out),JSON.stringify({license:'CC-BY-4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',sources,samples},null,2)+'\n');
