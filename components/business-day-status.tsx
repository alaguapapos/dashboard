'use client';
import {useEffect,useState} from 'react';
import {dayStatus,CLOSING_LABEL} from '@/lib/data/business-day';
export function BusinessDayStatus({day}:{day:string}){
 const [now,setNow]=useState<Date|null>(null);
 useEffect(()=>{setNow(new Date());const interval=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(interval);},[]);
 return <small className="business-day-status">{now?dayStatus(day,now)+' · ':''}Cierre {CLOSING_LABEL}</small>;
}
