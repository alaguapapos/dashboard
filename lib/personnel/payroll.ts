import {type Shift,type PayDay} from './types.ts';
export const ZONE='America/Mexico_City';
export const PAID_CUTOFF_HOUR=19;
export function localDay(value:string|Date=new Date()):string {
 return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
export function validDay(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function validateRange(from:string,to:string){if(!validDay(from)||!validDay(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)throw Error('Selecciona un periodo válido de hasta 366 días.');}
// Mexico City has used UTC-6 year-round since 2023; personnel records begin in 2026.
export function dayStart(day:string){return Date.parse(day+'T00:00:00-06:00');}
export function payroll(shifts:Shift[],from:string,to:string):PayDay[]{
 validateRange(from,to);
 const groups=new Map<string,PayDay & {hourly:number;dailyRate:number}>();
 for(const shift of shifts){
  if(!shift.ended_at)continue; // Open shifts are live estimates, never finalized pay.
  let cursor=Math.max(Date.parse(shift.started_at),dayStart(from));
  // A forgotten checkout must not accrue pay overnight or on later days.
  // Preserve the actual attendance timestamps; only the pay window is capped.
  const cutoff=dayStart(localDay(shift.started_at))+PAID_CUTOFF_HOUR*3600000;
  const end=Math.min(Date.parse(shift.ended_at),cutoff,dayStart(to)+86400000);
  while(cursor<end){const day=localDay(new Date(cursor));const stop=Math.min(end,dayStart(day)+86400000);const seconds=(stop-cursor)/1000;
   const key=shift.worker_id+':'+day;const group=groups.get(key)??{worker_id:shift.worker_id,day,seconds:0,cents:0,daily:false,hourly:0,dailyRate:0};
   group.seconds+=seconds;
   if(shift.role==='lavador'){group.daily=true;group.dailyRate=Math.max(group.dailyRate,shift.rate_cents);}else group.hourly+=seconds*shift.rate_cents/3600;
   groups.set(key,group);cursor=stop;
  }
 }
 return [...groups.values()].map(({hourly,dailyRate,...day})=>({...day,cents:dailyRate+Math.round(hourly)})).sort((a,b)=>b.day.localeCompare(a.day)||a.worker_id.localeCompare(b.worker_id));
}

export function payPeriods(now:string|Date=new Date()){
 const day=localDay(now);const date=new Date(day+'T12:00:00Z');const weekday=date.getUTCDay();
 const weekFrom=new Date(date.getTime()-weekday*86400000).toISOString().slice(0,10);
 const weekTo=new Date(date.getTime()+(6-weekday)*86400000).toISOString().slice(0,10);
 const monthFrom=day.slice(0,7)+'-01';
 const monthTo=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12)).toISOString().slice(0,10);
 return {weekFrom,weekTo,monthFrom,monthTo};
}
