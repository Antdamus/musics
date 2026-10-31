const amount=value=>Number.isFinite(value)?Math.max(0,value):0;
export const dayKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function dayBucket(days,key){return days[key]??={ms:0,correct:0,wrong:0,missed:0,manual:0,onTime:0};}
// Calendar boundaries use local dates; a DST day need not contain 24 hours.
export function addActiveTime(days,from,milliseconds){
  let cursor=from,remaining=amount(milliseconds);
  if(!Number.isFinite(cursor))return;
  while(remaining>0){
    const date=new Date(cursor),next=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime();
    const part=Math.min(remaining,next-cursor);if(!(part>0))break;
    dayBucket(days,dayKey(date)).ms+=part;remaining-=part;cursor+=part;
  }
}
export function mergeSessions(a=[],b=[],limit=365){
  const records=new Map();
  for(const item of [...a,...b]){
    if(!item||typeof item!=='object')continue;
    const key=item.id||JSON.stringify(item),old=records.get(key);
    const rank=entry=>[amount(entry.version),amount(entry.updatedAt||entry.at),amount(entry.ms),entry.completed?1:0];
    const newer=!old||rank(item).some((n,i,r)=>r.slice(0,i).every((v,j)=>v===rank(old)[j])&&n>rank(old)[i]);
    if(newer)records.set(key,structuredClone(item));
  }
  return [...records.values()].sort((x,y)=>amount(x.at)-amount(y.at)).slice(-limit);
}
export function formatPracticeTime(ms){
  const seconds=Math.floor(amount(ms)/1000);
  if(!seconds)return ms>0?'<1s':'0m';
  if(seconds<60)return `${seconds}s`;
  const minutes=Math.floor(seconds/60),rest=seconds%60;
  if(minutes<60)return `${minutes}m${rest?' '+rest+'s':''}`;
  return `${Math.floor(minutes/60)}h${minutes%60?' '+minutes%60+'m':''}`;
}
export function weekSummary(sessions,now=new Date(),offset=0){
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  start.setDate(start.getDate()-((start.getDay()+6)%7)+Math.min(0,offset)*7);
  const days=Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(date.getDate()+i);return {key:dayKey(date),date,ms:0,correct:0,wrong:0,missed:0,manual:0,onTime:0};});
  const byKey=new Map(days.map(d=>[d.key,d])),entries=[];
  for(const session of mergeSessions(sessions,[])){
    const dated=session.days&&typeof session.days==='object'&&!Array.isArray(session.days)?Object.entries(session.days):[[dayKey(new Date(session.at)),session]];
    let ms=0;
    for(const [key,data] of dated){const day=byKey.get(key);if(!day||!data)continue;ms+=amount(data.ms);for(const field of ['ms','correct','wrong','missed','manual','onTime'])day[field]+=amount(data[field]);}
    if(ms>0)entries.push({session,weekMs:ms});
  }
  entries.sort((a,b)=>(b.session.at||0)-(a.session.at||0));
  const sum=field=>days.reduce((n,d)=>n+d[field],0),attempts=sum('correct')+sum('wrong')+sum('missed');
  return {start,end:days[6].date,days,entries,ms:sum('ms'),count:entries.length,activeDays:days.filter(d=>d.ms>0).length,correct:sum('correct'),attempts,manual:sum('manual'),accuracy:attempts?Math.round(sum('correct')/attempts*100):null};
}
