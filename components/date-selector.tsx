'use client';
import {useState,type ComponentProps} from 'react';
import {CalendarDays,ChevronDown,X} from 'lucide-react';
import {es} from 'react-day-picker/locale';
import type {DateRange} from 'react-day-picker';
import {Calendar,CalendarDayButton} from '@/components/ui/calendar';
import {Button} from '@/components/ui/button';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
const parse=(value:string)=>{const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d,12);};
const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const label=(value:string)=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(parse(value));
function BusinessDayButton(props:ComponentProps<typeof CalendarDayButton>){
 const closed=props.day.date.getDay()===0;
 return <CalendarDayButton {...props} aria-label={closed?props['aria-label']+' · Cerrado':props['aria-label']} className={[props.className,closed?'calendar-closed-day':''].filter(Boolean).join(' ')}>{props.children}{closed&&<small aria-hidden="true" className="calendar-closed-label">Cerrado</small>}</CalendarDayButton>;
}
export function DateSelector({from,to,today,onChange}:{from:string;to:string;today:string;onChange:(from:string,to:string)=>void}){
 const [open,setOpen]=useState(false),[mode,setMode]=useState<'single'|'range'>('single');
 const [range,setRange]=useState<DateRange|undefined>();
 const [month,setMonth]=useState(()=>parse(to));
 const commit=(start:string,end=start)=>{onChange(start,end);setOpen(false);};
 function quick(which:string){const end=parse(today),start=parse(today);if(which==='yesterday')start.setDate(start.getDate()-1);if(which==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);if(which==='month')start.setDate(1);commit(key(start),which==='yesterday'?key(start):key(end));}
 return <Popover open={open} onOpenChange={value=>{setOpen(value);if(value){setMode('single');setRange(undefined);setMonth(parse(to));}}}>
  <PopoverTrigger asChild><Button variant="outline" className="date-selector-trigger" aria-label="Seleccionar fecha o periodo"><CalendarDays size={18}/><span><small>{from===to?(parse(from).getDay()===0?'Domingo · Cerrado':'Día seleccionado'):'Periodo seleccionado'}</small><strong>{from===to?label(from):`${label(from)} — ${label(to)}`}</strong></span><ChevronDown size={17}/></Button></PopoverTrigger>
  <PopoverContent className="calendar-popover" align="start" collisionPadding={12} aria-label="Seleccionar fechas">
   <div className="calendar-title"><h2>Selecciona una fecha</h2><button type="button" className="icon-button" aria-label="Cerrar calendario" onClick={()=>setOpen(false)}><X size={18}/></button></div>
   <div className="calendar-modes" role="group" aria-label="Tipo de selección"><button type="button" aria-pressed={mode==='single'} onClick={()=>setMode('single')}>Un día</button><button type="button" aria-pressed={mode==='range'} onClick={()=>{setMode('range');setRange(undefined);}}>Rango de fechas</button></div>
   <p className="calendar-help">{mode==='single'?'Toca el día que quieres consultar.':'Selecciona la fecha inicial y después la final.'}</p>
   {mode==='single'?<Calendar components={{DayButton:BusinessDayButton}} className="calendar-picker" mode="single" locale={es} weekStartsOn={1} month={month} onMonthChange={setMonth} captionLayout="dropdown" startMonth={new Date(2020,0)} endMonth={parse(today)} disabled={{after:parse(today)}} selected={from===to?parse(from):undefined} onSelect={day=>{if(day)commit(key(day));}}/>:<Calendar components={{DayButton:BusinessDayButton}} className="calendar-picker" mode="range" locale={es} weekStartsOn={1} month={month} onMonthChange={setMonth} captionLayout="dropdown" startMonth={new Date(2020,0)} endMonth={parse(today)} disabled={{after:parse(today)}} selected={range} onSelect={setRange} max={366}/>}
   {mode==='range'&&<div className="calendar-range"><p>{range?.from?label(key(range.from)):'Inicio'} — {range?.to?label(key(range.to)):'Fin'}</p><Button className="primary-button" disabled={!range?.from||!range?.to} onClick={()=>{if(range?.from&&range.to)commit(key(range.from),key(range.to));}}>Aplicar rango</Button></div>}
   <div className="calendar-presets"><select aria-label="Periodos rápidos" value="" onChange={e=>quick(e.target.value)}><option value="" disabled>Periodos rápidos…</option><option value="today">Hoy</option><option value="yesterday">Ayer</option><option value="week">Esta semana</option><option value="month">Este mes</option></select></div>
  </PopoverContent>
 </Popover>;
}
