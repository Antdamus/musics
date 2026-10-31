import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {arrangement,progression} from '../fretboard/backing.mjs';
import {ROOTS,SCALES,sanitizeSettings,scalePCs,spell} from '../fretboard/music.mjs';

test('rumba brushes follow the displayed chords in all keys, with short muted strokes and an in-scale cadence',()=>{
  const config={backing:'rumba',scale:'phrygianDominant',root:4};
  assert.equal(sanitizeSettings(config).backing,'rumba');
  assert.deepEqual(progression(config).map(c=>c.name),['Am','Dm','F','E']);
  assert.deepEqual(progression({...config,scale:'phrygian'}).map(c=>c.name),['Am','G','F','Em']);
  const files=new Set();
  for(const scale of Object.keys(SCALES))for(const root of ROOTS.keys()){
    const s={...config,scale,root},chords=progression(s),plan=arrangement(s);
    for(const [beat,events] of plan.entries()){
      const chord=chords[Math.floor(beat/4)];
      for(const e of events){
        assert.ok(chord.pcs.includes(e.midi%12)&&scalePCs(s).includes(e.midi%12));
        assert.ok(e.file.startsWith('guitar/nylon/'));files.add(e.file);
      }
      if(beat%4===0){
        assert.equal(events[0].midi%12,chord.pcs[0]);
        const up=events.filter(e=>e.offset===.5);assert.ok(up[0].midi>up[1].midi&&up[0].spread<up[1].spread);
      }
      if(beat%4===1)assert.ok(events.some(e=>e.maxDuration<=.1));
    }
  }
  for(const file of files)assert.equal(readFileSync(new URL('../fretboard/samples/'+file,import.meta.url)).toString('ascii',0,4),'OggS');
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
