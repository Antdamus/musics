import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {arrangement,progression} from '../fretboard/backing.mjs';
import {ROOTS,SCALES,sanitizeSettings,scalePCs,spell} from '../fretboard/music.mjs';

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
