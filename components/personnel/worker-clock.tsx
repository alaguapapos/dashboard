'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ChevronRight,CheckCircle2,Droplets,LogIn,LogOut,RefreshCw} from 'lucide-react';
import {ThemeToggle} from '@/components/theme-toggle';
import {ROLE_LABEL,type WorkerRole} from '@/lib/personnel/types';
import {timestamp} from './shared';
import styles from './worker-clock.module.css';
type ClockWorker={id:string;name:string;role:WorkerRole};
export default function WorkerClock(){
 const [workers,setWorkers]=useState<ClockWorker[]>([]),[selected,setSelected]=useState<ClockWorker|null>(null),[pin,setPin]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef<{id:string;workerId:string;operation:string}|null>(null),sending=useRef(false);
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/equipo',{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error);setWorkers(data.workers);}catch(e){setError(e instanceof Error?e.message:'No hay conexión. Intenta actualizar.');}finally{setLoading(false);}},[]);
 // Fetch the shared roster without restoring a worker identity.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},30000);return()=>clearInterval(timer);},[refresh]);
 useEffect(()=>{if(!selected||busy)return;const timer=setTimeout(()=>{setSelected(null);setPin('');setError('');},30000);return()=>clearTimeout(timer);},[selected,pin,busy]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),7000);return()=>clearTimeout(timer);},[notice]);
 function choose(worker:ClockWorker|null){setSelected(worker);setPin('');setError('');setNotice('');}
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selected||sending.current)return;
  const operation=((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null)?.value;
  if(operation!=='in'&&operation!=='out'){setError('Selecciona Registrar entrada o Registrar salida.');return;}
  if(!pending.current||pending.current.workerId!==selected.id||pending.current.operation!==operation)pending.current={id:Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),workerId:selected.id,operation};
  const request=pending.current;const enteredPin=pin;setPin('');setBusy(true);sending.current=true;setError('');
  try{
   const r=await fetch('/api/equipo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clock',workerId:selected.id,pin:enteredPin,operation,requestId:request.id})});
   const data=await r.json();if(!r.ok){if(r.status<500)pending.current=null;throw Error(data.error||'No se pudo registrar. Intenta de nuevo.');}
   pending.current=null;setSelected(null);setNotice(`${data.name}: ${operation==='in'?'entrada':'salida'} registrada · ${timestamp(data.at)}`);
  }catch(e){setError(e instanceof Error?e.message:'No hay conexión. Reingresa tu PIN e intenta de nuevo.');}finally{setBusy(false);sending.current=false;}
 }
 return <main className={styles.page}><header className={styles.header}><div className={styles.brand}><Droplets size={24}/>AL AGUA PAPOS</div><ThemeToggle/></header><div className={styles.content}><p className={styles.eyebrow}>CHECADOR DEL EQUIPO</p><h1>Registra tu entrada y salida con tu acceso personal</h1><p className={styles.subtitle}>Selecciona tu nombre e ingresa tu PIN para registrar tu jornada.</p>
 {notice&&<div className={styles.success} role="status"><CheckCircle2 size={22}/><span>{notice}<small>Listo. El siguiente trabajador puede seleccionar su nombre.</small></span></div>}
 {error&&<div className={styles.error} role="alert">{error}{!selected&&<button className={styles.retry} onClick={()=>{setError('');void refresh();}}><RefreshCw size={16}/>Actualizar</button>}</div>}
 {selected?<section className={styles.pinCard}><button className={styles.back} disabled={busy} onClick={()=>choose(null)}><ArrowLeft size={18}/>Cambiar trabajador</button><div className={styles.selected}><span className={styles.avatar}>{selected.name.slice(0,1)}</span><h2>{selected.name}</h2><p>{ROLE_LABEL[selected.role]}</p></div><form className={styles.form} onSubmit={submit} autoComplete="off"><label htmlFor="worker-pin">Ingresa tu PIN de 4 dígitos</label><input id="worker-pin" name="worker-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} required autoComplete="off" autoFocus disabled={busy} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="••••"/><div className={styles.actions}><button type="submit" value="in" disabled={busy||pin.length!==4} className={styles.entry}><LogIn size={22}/>Registrar entrada</button><button type="submit" value="out" disabled={busy||pin.length!==4} className={styles.exit}><LogOut size={22}/>Registrar salida</button></div>{busy&&<p role="status">Guardando registro…</p>}<small>Tu PIN se borra después de cada acción. No necesitas cerrar sesión.</small></form></section>:loading?<p className={styles.empty} role="status">Cargando equipo…</p>:<div className={styles.roster} aria-label="Selecciona tu nombre">{workers.map(w=><button key={w.id} className={styles.worker} onClick={()=>choose(w)}><span className={styles.avatar}>{w.name.slice(0,1)}</span><span className={styles.workerName}><strong>{w.name}</strong><small>{ROLE_LABEL[w.role]}</small></span><ChevronRight size={21}/></button>)}{!workers.length&&<p className={styles.empty}>No hay trabajadores disponibles. Consulta al administrador.</p>}</div>}
 <p className={styles.footer}>Horario pagado hasta las 19:00 · Ciudad de México<br/>Se conserva la hora real de salida.</p></div></main>;
}
