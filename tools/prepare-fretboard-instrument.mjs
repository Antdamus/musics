// Rebuild one stage instrument with Node, curl and FFmpeg.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const run=promisify(execFile),instrument=process.argv[2];
const libraries={
  sax:{name:'Karoryfer Weresax',repo:'sfzinstruments/karoryfer.weresax',revision:'a4d756b21d2a573aca0d840cce7e71ba5effd4c6',map:'Programs/alto_map_piano_condenser.sfz'},
  piano:{name:'Versilian Community Sample Library · Steinway B',repo:'sgossner/VCSL',revision:'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e',tail:8},
  electric:{name:'FreePats Electric Guitar FSBS Dist1',repo:'freepats/electric-guitar-FSBS-dist1',revision:'bbae17f0ad16f5edd7ec22178d181f3e3f6696fa',map:'EGuitarFSBS-dist1 bridge 20220911.sfz',licenseFile:'LICENSE.txt',tail:4},
  rockbass:{name:'Karoryfer Black And Blue Basses · Baby Blue',repo:'sfzinstruments/karoryfer.black-and-blue-basses',revision:'6e7d674cdb41be7a54dbccb15472401ad01099b9',map:'Programs/maps/babyblue_reg_f_map.sfz',licenseFile:'license',tail:4},
  violin:{name:'Versilian Chamber Orchestra 2 CE · Solo Violin',repo:'sgossner/VSCO-2-CE',revision:'440300901dfe9275fd84e0b7763af1f8443ae62e',tail:6}
};
if(!Object.hasOwn(libraries,instrument))throw Error('Choose an instrument: '+Object.keys(libraries).join(', '));
const library=libraries[instrument],base='https://raw.githubusercontent.com/'+library.repo+'/'+library.revision+'/';
const url=path=>base+path.split('/').map(encodeURIComponent).join('/');
const out=new URL('../fretboard/samples/'+instrument+'/',import.meta.url),temp=new URL('../test-results/'+instrument+'-source/',import.meta.url);
await Promise.all([out,temp].map(dir=>mkdir(dir,{recursive:true})));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fetchFile(path,dest){
  await run('curl',['-fsSL','--retry','5','--retry-all-errors','--max-time','45',url(path),'-o',fileURLToPath(dest)],{windowsHide:true});
  return readFile(dest);
}
const regions=[];
if(instrument==='sax'){
  const sfz=await fetchFile(library.map,new URL('map.sfz',temp));
  for(const region of sfz.toString().split('<region>').slice(1)){
    const midi=Number(region.match(/pitch_keycenter=(\d+)/)?.[1]??60);if(midi<55||midi>73)continue;
    const name=region.match(/sample=.*?([a-g]b?\d+_p_rr([12])_cnd\.wav)/);if(!name)throw Error('Unknown region');
    regions.push({midi,take:Number(name[2]),source:'Samples/alto/'+name[1]});
  }
  if(regions.length!==38)throw Error('Unexpected publisher mapping');
}else if(instrument==='piano'){
  for(let midi=54;midi<=74;midi+=2){
    const note=['C','D','E','F#','G#','A#'][midi%12/2]+(Math.floor(midi/12)-1);
    regions.push({midi,take:1,source:'Chordophones/Zithers/Grand Piano, Steinway B/Sus/JHPiano_Sus_Close_'+note+'_vl2_rr1.wav'});
  }
}else if(instrument==='electric'){
  for(const [midi,stem] of [[40,'E2_s1'],[41,'F2_s1'],[45,'A2_s2'],[48,'C3_s2'],[50,'D3_s3'],[52,'E3_s3'],[55,'G3_s4'],[59,'B3_s5']]){
    for(const take of [1,2])regions.push({midi,take,source:'samples/bridge/'+stem+'_0'+take+'.flac'});
  }
}else if(instrument==='rockbass'){
  // The published bass map uses written pitches, an octave above the recorded sound.
  for(let midi=28;midi<=46;midi+=2){
    const note=['c','d','e','gb','ab','bb'][midi%12/2]+Math.floor(midi/12);
    for(const take of [1,2])regions.push({midi,take,source:'Samples/babyblue/reg/babyblue_'+note+'_f_rr'+take+'.wav'});
  }
}else if(instrument==='violin'){
  for(const [midi,note] of [[67,'G4'],[69,'A4'],[72,'C5'],[76,'E5'],[79,'G5']])
    regions.push({midi,take:1,source:'Strings/Solo Violin/Arco Vib/LLVln_ArcoVib_'+note+'_p.wav'});
}
const samples=[];
async function prepare({midi,take,source}){
  const file=midi+'-'+take+'.ogg',raw=new URL(file+source.slice(source.lastIndexOf('.')),temp),original=await fetchFile(source,raw),dest=new URL(file,out);
  if(!['RIFF','fLaC'].includes(original.toString('ascii',0,4)))throw Error('Expected an audio recording: '+source);
  const filters='silenceremove=start_periods=1:start_threshold=-64dB:start_silence=0.003'+(library.tail?',atrim=duration='+library.tail+',afade=t=out:st='+(library.tail-.5)+':d=0.5':'');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',fileURLToPath(raw),'-map_metadata','-1','-af',filters,'-c:a','libvorbis','-q:a','6',fileURLToPath(dest)],{windowsHide:true});
  const encoded=await readFile(dest);samples.push({midi,take,file,bytes:encoded.length,sha256:hash(encoded),source:url(source),originalSha256:hash(original)});
}
for(let i=0;i<regions.length;i+=3)await Promise.all(regions.slice(i,i+3).map(prepare));
await fetchFile(library.licenseFile??'LICENSE',new URL('LICENSE.txt',out));
samples.sort((a,b)=>a.midi-b.midi||a.take-b.take);
await writeFile(new URL('sources.json',out),JSON.stringify({library:library.name,license:'CC0-1.0',revision:library.revision,...(library.map?{mapping:url(library.map)}:{}),samples},null,2)+'\n');
console.log(samples.length+' '+instrument+' recordings; '+samples.reduce((n,s)=>n+s.bytes,0)+' bytes');
