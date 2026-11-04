'use client';
import {useEffect,useState} from 'react';
import {dayStatus,isClosedDay,CLOSING_LABEL} from '@/lib/data/business-day';
export function BusinessDayStatus({day}:{day:string}){
 const [now,setNow]=useState<Date|null>(null);
 // Start the client clock after hydration, then synchronize it with elapsed time.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{setNow(new Date());const interval=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(interval);},[]);
 return <small className="business-day-status">{isClosedDay(day)?'Domingo · cerrado':<>{now?dayStatus(day,now)+' · ':''}Cierre {CLOSING_LABEL}</>}</small>;
}
