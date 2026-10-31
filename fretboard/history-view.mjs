import {weekSummary,formatPracticeTime} from './practice-history.mjs?v=1';
import {ROOTS,noteName} from './music.mjs?v=6';
const $=id=>document.getElementById(id);
const element=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;};
export function createHistoryView({getSessions,onOpen}){
  let offset=0,limit=10;
  function render(){
    const week=weekSummary(getSessions(),new Date(),offset),dateFormat={month:'short',day:'numeric'};
    $('history-week-title').textContent=offset===0?'This week':offset===-1?'Last week':'Your practice week';
    $('history-week-range').textContent=`${week.start.toLocaleDateString(undefined,{...dateFormat,...(week.start.getFullYear()!==week.end.getFullYear()?{year:'numeric'}:{})})} – ${week.end.toLocaleDateString(undefined,{...dateFormat,year:'numeric'})}`;
    $('history-next').disabled=offset===0;$('history-today').hidden=offset===0;
    $('week-time').textContent=formatPracticeTime(week.ms);$('week-days').textContent=`${week.activeDays} / 7`;
    $('week-sessions').textContent=week.count;$('week-notes').textContent=week.correct;
    $('week-accuracy').textContent=week.accuracy===null?'Play and check some notes to see your results.':`${week.accuracy}% correct across ${week.attempts} checks and unplayed notes.${week.manual?' Includes manual self-checks.':''}`;
    const max=Math.max(60000,...week.days.map(d=>d.ms)),chart=$('history-days');chart.replaceChildren();
    for(const day of week.days){
      const item=element('li','history-day'),label=day.date.toLocaleDateString(undefined,{weekday:'short'}),duration=formatPracticeTime(day.ms);
      item.setAttribute('aria-label',`${day.date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}: ${duration}, ${day.correct} notes checked`);
      item.append(element('span','history-day-time',duration));
      const track=element('div','history-day-track'),bar=element('div','history-day-bar');bar.style.height=day.ms?`${Math.max(3,day.ms/max*100)}%`:'0';track.append(bar);item.append(track,element('strong','history-day-label',label));chart.append(item);
    }
    $('history-empty').hidden=week.count>0;$('history-session-list').replaceChildren();
    for(const {session,weekMs} of week.entries.slice(0,limit)){
      const item=element('li','history-session'),heading=element('div','history-session-heading');
      const when=new Date(session.at).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      heading.append(element('strong','',when),element('span','history-session-time',formatPracticeTime(weekMs)));item.append(heading);
      const bpms=(Array.isArray(session.bpms)?session.bpms:[session.bpm]).filter(n=>Number.isFinite(n)&&n>=1&&n<=180);
      const min=Math.min(...bpms),maxTempo=Math.max(...bpms),tempo=bpms.length?`${min===maxTempo?min:min+'–'+maxTempo} BPM`:'Tempo not recorded';
      const notes=Array.isArray(session.notes)&&session.notes.length?session.notes.filter(n=>Number.isInteger(n)&&n>=40&&n<=85).map(n=>noteName(n)).join(', '):(Array.isArray(session.pool)?session.pool.filter(n=>Number.isInteger(n)&&n>=0&&n<12).map(n=>ROOTS[n]).join(', '):'');
      const checked=Number.isFinite(session.correct)?session.correct:0;
      item.append(element('p','history-session-detail',`${tempo} · ${checked} notes checked${session.manual?' · includes self-checks':''}`));
      if(notes)item.append(element('p','history-session-notes',`Notes studied: ${notes}${!session.notes?.length?' (note families)':''}`));
      const status=session.completed===false?'Saved automatically':'Finished session';
      item.append(element('small','history-session-status',`${status}${Math.abs(weekMs-session.ms)>1?' · '+formatPracticeTime(session.ms)+' total, time shown is for this week':''}`));
      $('history-session-list').append(item);
    }
    $('history-more').hidden=week.count<=limit;
  }
  const move=amount=>{offset=Math.min(0,offset+amount);limit=10;render();};
  $('history-prev').onclick=()=>move(-1);$('history-next').onclick=()=>move(1);
  $('history-today').onclick=()=>{offset=0;limit=10;render();};
  $('history-more').onclick=()=>{limit+=10;render();};
  $('history-open').onclick=()=>{onOpen();render();};
  return {render,reset(){offset=0;limit=10;}};
}
