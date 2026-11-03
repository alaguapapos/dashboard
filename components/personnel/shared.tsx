'use client';
import {useEffect,useState} from 'react';
import {ZONE} from '@/lib/personnel/payroll';
export const money=(cents:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(cents/100);
export const timestamp=(value:string)=>new Intl.DateTimeFormat('es-MX',{timeZone:ZONE,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
export const hours=(seconds:number)=>`${Math.floor(seconds/3600)} h ${Math.floor(seconds%3600/60)} min`;
export function Elapsed({start,serverNow}:{start:string;serverNow:string}){
 const [elapsed,setElapsed]=useState(()=>Math.max(0,(Date.parse(serverNow)-Date.parse(start))/1000));
 useEffect(()=>{const baseline=performance.now();const initial=Math.max(0,(Date.parse(serverNow)-Date.parse(start))/1000);const tick=()=>setElapsed(initial+(performance.now()-baseline)/1000);tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[start,serverNow]);
 return <span>{hours(elapsed)}</span>;
}
export async function post(url:string,body:unknown){const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo guardar.');return data;}
