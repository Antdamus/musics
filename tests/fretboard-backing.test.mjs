import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {arrangement,progression} from '../fretboard/backing.mjs';
import {rumbaPhrase,fitRumbaBar} from '../fretboard/rumba-phrases.mjs';
import {ROOTS,SCALES,mod,sanitizeSettings,scalePCs,spell} from '../fretboard/music.mjs';

test('rumba offers a descending cadence independently of the exercise scale',()=>{
  const config={backing:'rumba',scale:'phrygianDominant',root:4};
  assert.equal(sanitizeSettings(config).rumbaCadence,false);
  assert.deepEqual(progression(config).map(c=>c.name),['Am','Dm','F','E']);
  assert.deepEqual(progression({...config,scale:'phrygian'}).map(c=>c.name),['Am','G','F','Em']);
  const classic=sanitizeSettings({...config,rumbaCadence:true,pool:[4]});
  assert.equal(classic.rumbaCadence,true);assert.deepEqual(classic.pool,[4]);
  assert.deepEqual(progression(classic).map(c=>c.name),['Am','G','F','E']);
  assert.deepEqual(progression({...classic,root:6,scale:'minor'}).map(c=>c.name),['F♯m','E','D','C♯']);
  assert.deepEqual(progression({...classic,backing:'nylon'}),progression({...config,backing:'nylon'}));
});

test('ventilador uses the displayed harmony, with the upstroke accent on 2-and and the hand stop on 3 in every bar',()=>{
  const base=new URL('../fretboard/samples/rumba-guitar/',import.meta.url);
  const library=JSON.parse(readFileSync(new URL('sources.json',base))),files=new Set();
  assert.equal(library.license,'CC0-1.0');
  for(const sample of library.samples){
    const bytes=readFileSync(new URL(sample.file,base));
    assert.equal(bytes.toString('ascii',0,4),'OggS');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sample.sha256);
    files.add('rumba-guitar/'+sample.file);
  }
  const tones={power:[0,7],major:[0,4,7],minor:[0,3,7],sus4:[0,5,7]};
  for(const scale of Object.keys(SCALES))for(const root of ROOTS.keys())for(const rumbaCadence of [false,true]){
    const s={backing:'rumba',scale,root,rumbaCadence,bpm:39},chords=progression(s),plan=arrangement(s);
    assert.equal(plan.length,16);
    for(const [bar,chord] of chords.entries()){
      if(!rumbaCadence)assert.ok(chord.pcs.every(pc=>scalePCs(s).includes(pc)));
      const levels=[];
      for(let eighth=0;eighth<8;eighth++){
        const events=plan[bar*4+Math.floor(eighth/2)].filter(e=>e.offset===(eighth%2)/2);
        if(eighth===0)assert.ok(events.some(e=>e.file==='rumba-guitar/body.ogg'));
        if(eighth===4){assert.equal(events.length,1);assert.match(events[0].file,/mute-(mid|low)\.ogg$/);}
        assert.ok(events.length);levels.push(Math.max(...events.map(e=>e.level)));
        for(const e of events){
          assert.ok(e.length>0&&eighth/2+e.length<=(eighth<4?2:4));
          if(eighth===0&&e.file.endsWith('-down.ogg'))assert.ok(e.length>.5);
          assert.ok(files.has(e.file),e.file);
          if(eighth===4||e.file.endsWith('/body.ogg'))continue;
          const [,quality,native,stroke]=e.file.match(/\/(major|minor|sus4|power)-(\d+)-(down|up|brush)\.ogg$/);
          assert.equal(stroke,eighth%2===0?'down':eighth===3||quality==='power'?'up':'brush');
          const played=mod(Number(native)+Math.round(12*Math.log2(e.rate)));
          assert.deepEqual(tones[quality].map(n=>mod(played+n)),chord.pcs);
        }
      }
      assert.equal(levels.indexOf(Math.max(...levels)),3);
    }
  }
});

test('performed bars cover all major and minor chords from 40 to 180 BPM with the displayed root',()=>{
  const base=new URL('../fretboard/samples/rumba-phrases/',import.meta.url);
  const lib=JSON.parse(readFileSync(new URL('sources.json',base))),files=new Set();
  assert.equal(lib.license,'CC-BY-4.0');
  for(const sample of lib.samples){
    assert.ok(lib.sources.some(s=>s.page.endsWith('/'+sample.id+'/')));
    assert.equal(createHash('sha256').update(readFileSync(new URL(sample.file,base))).digest('hex'),sample.sha256);
    files.add(sample.file);
  }
  for(let bpm=40;bpm<=180;bpm++)for(let root=0;root<12;root++)for(const third of [3,4]){
    const pcs=[root,mod(root+third),mod(root+7)];
    const {file,rate}=rumbaPhrase(pcs,bpm),name=file.split('/')[1];
    assert.ok(files.has(name));const [quality,native,tempo]=name.split('.')[0].split('-');
    assert.equal(quality,third===3?'minor':'major');
    const shift=Math.round(12*Math.log2(rate));assert.ok(Math.abs(shift)<=2);
    assert.equal(mod(Number(native)+shift),root);
    assert.ok(Math.abs(Math.log(bpm/rate/Number(tempo)))<.35);
  }
  for(const chord of [[0,5,7],[0,7]])assert.equal(rumbaPhrase(chord,108),null);
  for(const bpm of [1,39])assert.equal(rumbaPhrase([0,4,7],bpm),null);
});

test('fitting a recorded bar preserves pitch, stereo phase and a continuous signal at the requested duration',()=>{
  const ctx={createBuffer(ch,length,sampleRate){
    const data=Array.from({length:ch},()=>new Float32Array(length));return {length,sampleRate,numberOfChannels:ch,getChannelData:i=>data[i]};
  }};
  const sr=24000,source=ctx.createBuffer(2,48000,sr);
  for(let i=0;i<source.length;i++){
    source.getChannelData(0)[i]=Math.sin(i*2*Math.PI*220/sr);source.getChannelData(1)[i]=-source.getChannelData(0)[i];
  }
  for(const seconds of [1.64,2,2.6]){
    const bar=fitRumbaBar(ctx,source,seconds),left=bar.getChannelData(0),right=bar.getChannelData(1);let crossings=0;
    assert.equal(bar.length,Math.round(sr*seconds));
    for(let i=1;i<left.length;i++){
      assert.equal(left[i]+right[i],0);if(left[i]>0&&left[i-1]<=0)crossings++;
    }
    assert.ok(Math.abs(crossings/seconds-220)<1);
    for(let i=0;i+480<left.length;i+=480)assert.ok(left.subarray(i,i+480).some(x=>x>.9));
  }
});

test('electric rock stays in scale, uses recorded pitches and allows each extra band member independently',()=>{
  const base=new URL('../fretboard/samples/',import.meta.url),recordings=new Map();
  for(const instrument of ['electric','rockbass','piano','violin']){
    const library=JSON.parse(readFileSync(new URL(instrument+'/sources.json',base)));
    assert.equal(library.license,'CC0-1.0');
    for(const sample of library.samples){
      const file=instrument+'/'+sample.file,bytes=readFileSync(new URL(file,base));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),sample.sha256);
      recordings.set(file,sample.midi);
    }
  }
  for(const scale of Object.keys(SCALES))for(const root of ROOTS.keys()){
    const bare=sanitizeSettings({scale,root,backing:'electricRock'}),rhythm=arrangement(bare);
    assert.equal(bare.backing,'electricRock');assert.equal(bare.rockPiano,false);assert.equal(bare.rockViolin,false);
    for(const rockPiano of [false,true])for(const rockViolin of [false,true]){
      const s=sanitizeSettings({...bare,rockPiano,rockViolin}),beats=arrangement(s),notes=beats.flat(),pcs=scalePCs(s);
      const kinds=['electric','rockbass',...(rockPiano?['piano']:[]),...(rockViolin?['violin']:[])];
      assert.deepEqual(new Set(notes.map(n=>n.file.split('/')[0])),new Set(kinds));
      assert.deepEqual(beats.map(events=>events.filter(e=>/^(electric|rockbass)\//.test(e.file))),rhythm);
      for(const e of notes){
        const native=recordings.get(e.file);assert.ok(Number.isFinite(native));
        assert.ok(pcs.includes(e.midi%12));assert.ok(Math.abs(native-e.midi)<=2);assert.equal(e.rate,2**((e.midi-native)/12));
        assert.ok(e.offset>=0&&e.offset<1&&e.length>0);
      }
      assert.equal(beats[11].find(e=>e.file.startsWith('rockbass/')).midi%12,progression(s)[3].pcs[1]);
      for(const start of [0,4,8,12]){
        const guitar=beats[start].find(e=>e.file.startsWith('electric/')),bass=beats[start].find(e=>e.file.startsWith('rockbass/'));
        assert.equal(guitar.midi-bass.midi,12);assert.equal(guitar.midi%12,progression(s)[start/4].pcs[0]);
      }
    }
  }
});

test('Phrygian dominant includes its flat second and major third in both the notation and duet',()=>{
  const s=sanitizeSettings({root:4,scale:'phrygianDominant',pool:[4],backing:'duo',backingVolume:44});
  assert.deepEqual(s.pool,[4]);assert.equal(s.backingVolume,44);
  assert.deepEqual(scalePCs(s).map(n=>spell(60+n,s).name.replace(/\d+$/,'')),['E','F','G♯','A','B','C','D']);
  assert.deepEqual(progression(s).map(c=>c.name),['E','F','Dm','E']);
  for(const style of ['groove','nylon','duo']){
    const pitches=arrangement({...s,backing:style}).flat().map(e=>e.midi%12);
    for(const pc of [4,5,8])assert.ok(pitches.includes(pc));
  }
});

test('every key and scale can play complete four-bar arrangements using only in-scale, available recordings',()=>{
  const base=new URL('../fretboard/samples/',import.meta.url),files=new Set();
  for(const scale of Object.keys(SCALES))for(const root of ROOTS.keys())for(const backing of ['groove','nylon','duo']){
    const s={scale,root,backing},pcs=scalePCs(s),bars=arrangement(s);assert.equal(bars.length,16);
    for(const e of bars.flat()){
      assert.ok(pcs.includes(e.midi%12));assert.ok(e.length>0&&e.offset>=0&&e.offset<1);
      assert.equal(e.file.startsWith('bass/'),backing==='groove'||(backing==='duo'&&!e.file.startsWith('guitar/')));
      if(e.file.startsWith('bass/'))assert.ok(Math.abs(12*Math.log2(e.rate))<1.01);
      files.add(e.file);
    }
  }
  for(const file of files)assert.equal(readFileSync(new URL(file,base)).toString('ascii',0,4),'OggS',file);
  const input=JSON.parse(readFileSync(new URL('bass/sources.json',base)));
  assert.equal(input.samples.length,18);
  for(const s of input.samples)assert.equal(createHash('sha256').update(readFileSync(new URL('bass/'+s.file,base))).digest('hex'),s.sha256);
});

test('sax trio keeps the duet and answers only at the ends of alternate bars, in concert pitch in every key',()=>{
  const base=new URL('../fretboard/samples/sax/',import.meta.url);
  const library=JSON.parse(readFileSync(new URL('sources.json',base)));
  const samples=new Map(library.samples.map(s=>[s.file,s]));
  for(const s of samples.values()){
    const bytes=readFileSync(new URL(s.file,base));assert.equal(bytes.toString('ascii',0,4),'OggS');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);
  }
  for(const scale of Object.keys(SCALES))for(const root of ROOTS.keys()){
    const s=sanitizeSettings({scale,root,backing:'saxTrio'});assert.equal(s.backing,'saxTrio');
    const part=arrangement(s),duo=arrangement({...s,backing:'duo'}),pcs=scalePCs(s);
    const sax=part.flatMap((events,beat)=>events.filter(e=>e.file.startsWith('sax/')).map(e=>({...e,beat})));
    assert.deepEqual(part.map(events=>events.filter(e=>!e.file.startsWith('sax/'))),duo);
    for(const start of [6,14]){
      const phrase=sax.filter(e=>e.beat>=start&&e.beat<start+2);
      assert.ok(phrase.length>=2);assert.equal(phrase.at(-1).midi%12,progression(s)[Math.floor(start/4)].pcs[0]);
    }
    for(const e of sax){
      const sample=samples.get(e.file.slice(4));assert.ok(sample);assert.equal(sample.midi,e.midi);
      assert.equal(e.rate,1);assert.ok(pcs.includes(e.midi%12));assert.ok([6,7,14,15].includes(e.beat));
      assert.ok(e.beat%4+e.offset+e.length<=4);
    }
  }
});

test('grand piano and bass play the displayed harmony in every key, with the closest recorded piano key',()=>{
  const base=new URL('../fretboard/samples/piano/',import.meta.url),library=JSON.parse(readFileSync(new URL('sources.json',base)));
  const samples=new Map(library.samples.map(s=>[s.file,s]));
  for(const s of samples.values()){
    const bytes=readFileSync(new URL(s.file,base));assert.equal(bytes.toString('ascii',0,4),'OggS');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),s.sha256);
  }
  for(const scale of Object.keys(SCALES))for(const root of ROOTS.keys()){
    const s=sanitizeSettings({scale,root,backing:'pianoDuo'});assert.equal(s.backing,'pianoDuo');
    const bars=arrangement(s),chords=progression(s);
    for(let i=0;i<4;i++){
      const piano=bars[i*4].filter(e=>e.file.startsWith('piano/'));
      assert.deepEqual(new Set(piano.map(e=>e.midi%12)),new Set(chords[i].pcs));
      assert.ok(bars[i*4].some(e=>e.file.startsWith('bass/')));
    }
    for(const e of bars.flat()){
      if(e.file.startsWith('bass/'))continue;
      const sample=samples.get(e.file.replace(/^piano\//,''));assert.ok(sample);
      assert.ok(Math.abs(e.midi-sample.midi)<=1);assert.equal(e.rate,2**((e.midi-sample.midi)/12));
    }
  }
});
