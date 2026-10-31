import {sanitizeSettings} from './music.mjs?v=6';
import {mergeSessions} from './practice-history.mjs?v=1';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const count=value=>Number.isFinite(value)?Math.max(0,value):0;
const clone=value=>structuredClone(value);
// JSONB may reorder object fields. Compare values, keeping array indices significant.
export function same(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
}
export function cleanData(value={}){
  value=object(value);
  const p=object(value.progress),notes={},positionUse={};
  for(const [pitch,n] of Object.entries(object(p.notes))){
    if(!/^\d+$/.test(pitch)||Number(pitch)<40||Number(pitch)>85)continue;
    notes[pitch]={correct:count(n?.correct),attempts:count(n?.attempts),last:count(n?.last),passes:Array.isArray(n?.passes)?n.passes.filter(x=>x&&typeof x==='object').slice(-30):[]};
  }
  for(const [key,n] of Object.entries(object(p.positionUse)))if(/^[1-6]:(?:[0-9]|1[0-9]|2[01])$/.test(key))positionUse[key]=count(n);
  return {settings:sanitizeSettings(value.settings),progress:{sessions:Array.isArray(p.sessions)?p.sessions.filter(x=>x&&typeof x==='object').slice(-365):[],notes,positionUse,resetAt:count(p.resetAt),imports:Array.isArray(p.imports)?[...new Set(p.imports.filter(x=>typeof x==='string'))].slice(-100):[]}};
}
function union(a=[],b=[],limit=365){
  const records=new Map();
  for(const item of [...a,...b])records.set(item.id||JSON.stringify(item),clone(item));
  return [...records.values()].sort((x,y)=>(x.at||0)-(y.at||0)).slice(-limit);
}
// Merge only work done since the common base. Retrying a save cannot count it twice.
export function mergeData(baseValue,localValue,remoteValue){
  const base=cleanData(baseValue),local=cleanData(localValue),remote=cleanData(remoteValue),result=clone(remote);
  for(const key of Object.keys(local.settings))if(!same(local.settings[key],base.settings[key]))result.settings[key]=clone(local.settings[key]);
  const b=base.progress,l=local.progress,r=remote.progress;
  if(l.resetAt!==r.resetAt){
    result.progress=clone(l.resetAt>r.resetAt?l:r);
    return cleanData(result);
  }
  const baseline=b.resetAt===l.resetAt?b:cleanData().progress,p=result.progress;
  p.sessions=mergeSessions(l.sessions,r.sessions);p.imports=[...new Set([...l.imports,...r.imports])];
  for(const pitch of new Set([...Object.keys(l.notes),...Object.keys(r.notes)])){
    const ln=l.notes[pitch]||{},rn=r.notes[pitch]||{},bn=baseline.notes[pitch]||{};
    p.notes[pitch]={correct:count(rn.correct)+Math.max(0,count(ln.correct)-count(bn.correct)),attempts:count(rn.attempts)+Math.max(0,count(ln.attempts)-count(bn.attempts)),last:Math.max(count(ln.last),count(rn.last)),passes:union(ln.passes,rn.passes,30)};
  }
  for(const key of new Set([...Object.keys(l.positionUse),...Object.keys(r.positionUse)]))p.positionUse[key]=count(r.positionUse[key])+Math.max(0,count(l.positionUse[key])-count(baseline.positionUse[key]));
  return cleanData(result);
}
export function hasPractice(data){const p=cleanData(data).progress;return p.sessions.length>0||Object.values(p.notes).some(n=>n.attempts>0);}
