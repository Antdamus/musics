import assert from 'node:assert/strict';
import {test} from 'node:test';
import {addActiveTime,dayKey,mergeSessions,weekSummary,formatPracticeTime} from '../fretboard/practice-history.mjs';
import {cleanData,mergeData} from '../fretboard/profile-data.mjs';
process.env.TZ='America/New_York';

test('weekly summary uses Monday–Sunday and includes saved legacy sessions without future or previous-week time',()=>{
  const sessions=[
    {at:new Date(2026,9,25,12).getTime(),ms:600000,correct:10},
    {at:new Date(2026,9,26,12).getTime(),ms:120000,correct:8,wrong:2},
    {at:new Date(2026,9,31,12).getTime(),ms:180000,correct:4,missed:2,manual:4},
    {at:new Date(2026,10,2,12).getTime(),ms:900000,correct:20}
  ];
  const week=weekSummary(sessions,new Date(2026,9,31));
  assert.equal(dayKey(week.start),'2026-10-26');assert.equal(dayKey(week.end),'2026-11-01');
  assert.equal(week.ms,300000);assert.equal(week.activeDays,2);assert.equal(week.count,2);
  assert.equal(week.correct,12);assert.equal(week.attempts,16);assert.equal(week.accuracy,75);assert.equal(week.manual,4);
  assert.equal(weekSummary(sessions,new Date(2026,9,31),-1).ms,600000);
  assert.equal(weekSummary([],new Date(2026,0,1)).start.getFullYear(),2025);
});

test('active time crossing midnight splits between weeks without allocating the paused gap',()=>{
  const days={};addActiveTime(days,new Date(2026,10,1,23,59).getTime(),120000);
  addActiveTime(days,new Date(2026,10,3,8).getTime(),60000);
  assert.equal(days['2026-11-01'].ms,60000);assert.equal(days['2026-11-02'].ms,60000);assert.equal(days['2026-11-03'].ms,60000);
  const session={id:'one',at:new Date(2026,10,1,23,59).getTime(),ms:180000,days};
  assert.equal(weekSummary([session],new Date(2026,9,31)).ms,60000);
  assert.equal(weekSummary([session],new Date(2026,10,3)).ms,120000);
});

test('day boundaries handle daylight saving days of 23 and 25 hours',()=>{
  for(const [month,day,hours] of [[2,8,23],[10,1,25]]){
    const start=new Date(2026,month,day),end=new Date(2026,month,day+1),days={};
    assert.equal(end-start,hours*3600000);addActiveTime(days,start.getTime(),end-start);
    assert.equal(Object.keys(days).length,1);assert.equal(days[dayKey(start)].ms,hours*3600000);
  }
});

test('checkpoint and finish snapshots update a single session even when an older device syncs later',()=>{
  const first={id:'session',at:100,updatedAt:200,version:1,ms:5000,completed:false};
  const latest={...first,updatedAt:400,version:3,ms:15000,completed:true};
  assert.deepEqual(mergeSessions([latest],[first]),[latest]);assert.deepEqual(mergeSessions([first],[latest]),[latest]);
  const base=cleanData();base.progress.sessions=[first];const local=structuredClone(base),remote=structuredClone(base);local.progress.sessions=[latest];
  assert.deepEqual(mergeData(base,local,remote).progress.sessions,[latest]);
  assert.deepEqual(mergeData(base,remote,local).progress.sessions,[latest]);
  assert.equal(weekSummary([first,latest],new Date(100)).count,1);
});

test('weekly note results come from each day and durations remain readable for short practice',()=>{
  const s={id:'split',at:new Date(2026,10,1).getTime(),ms:120000,correct:10,days:{'2026-11-01':{ms:60000,correct:3,wrong:1},'2026-11-02':{ms:60000,correct:7,manual:7}}};
  const first=weekSummary([s],new Date(2026,10,1)),second=weekSummary([s],new Date(2026,10,2));
  assert.equal(first.correct,3);assert.equal(first.accuracy,75);assert.equal(second.correct,7);assert.equal(second.manual,7);
  assert.equal(formatPracticeTime(15000),'15s');assert.equal(formatPracticeTime(90000),'1m 30s');assert.equal(formatPracticeTime(3900000),'1h 5m');
  assert.equal(weekSummary([{at:0,ms:Infinity},{at:'invalid',ms:1000}],new Date()).ms,0);
});
