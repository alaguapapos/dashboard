export const BUSINESS_TIME_ZONE='America/Mexico_City';
export const CLOSING_LABEL='7:30 p.m.';
export function businessClock(now=new Date()){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:BUSINESS_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const hour=Number(parts.find(p=>p.type==='hour')?.value),minute=Number(parts.find(p=>p.type==='minute')?.value);
 return {day,closed:hour*60+minute>=19*60+30};
}
export function dayStatus(day:string,now=new Date()){
 const current=businessClock(now);
 return day<current.day||(day===current.day&&current.closed)?'Jornada finalizada':'En curso';
}
