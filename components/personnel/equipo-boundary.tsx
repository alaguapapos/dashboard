'use client';
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ShieldCheck,RefreshCw} from 'lucide-react';
import {clearWorkerSession,WORKER_CHANGE_KEY} from '@/lib/personnel/shared-device';
import styles from './equipo-home.module.css';
function FreshSession({children}:{children:ReactNode}){
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const retry=useCallback(()=>{setError('');setReady(false);setAttempt(n=>n+1);},[]);
 useEffect(()=>{
  let active=true;
  void clearWorkerSession().then(()=>{if(active)setReady(true);}).catch(e=>{if(active)setError((e as Error).message);});
  const restored=(e:PageTransitionEvent)=>{if(e.persisted)retry();};
  const changed=(e:StorageEvent)=>{if(e.key===WORKER_CHANGE_KEY){active=false;setReady(false);setError('El teléfono cambió de trabajador. Vuelve a entrar con tu acceso.');}};
  window.addEventListener('pageshow',restored);window.addEventListener('storage',changed);
  return()=>{active=false;window.removeEventListener('pageshow',restored);window.removeEventListener('storage',changed);};
 },[attempt,retry]);
 if(ready)return children;
 return <main className={styles.waiting}><div className={styles.waitingHeading}><ShieldCheck size={24} aria-hidden="true"/><h1>Equipo Al Agua Papos</h1></div><p role={error?'alert':'status'}>{error||'Preparando acceso seguro…'}</p>{error&&<button onClick={retry}><RefreshCw size={18}/>Volver a entrar</button>}</main>;
}
export function EquipoBoundary({children}:{children:ReactNode}){const path=usePathname();return <FreshSession key={path}>{children}</FreshSession>;}
