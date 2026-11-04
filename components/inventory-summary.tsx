'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,Package} from 'lucide-react';
import styles from './inventory-summary.module.css';

type Counts={inShop:number;processing:number;ready:number;updatedAt:string};
const number=new Intl.NumberFormat('es-MX');

export function InventorySummary({refreshToken=0}:{refreshToken?:number}){
 const [counts,setCounts]=useState<Counts|null>(null);
 const [error,setError]=useState(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  let pending=false;
  async function load(){
   if(pending||document.visibilityState!=='visible')return;
   pending=true;
   try{
    const response=await fetch('/api/inventory/summary',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('Inventory unavailable');
    const result:Counts=await response.json();
    if(![result.inShop,result.processing,result.ready].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Invalid inventory counts');
    if(!controller.signal.aborted){setCounts(result);setError(false);}
   }catch{
    if(!controller.signal.aborted)setError(true);
   }finally{pending=false;}
  }
  void load();
  const interval=setInterval(load,60000);
  document.addEventListener('visibilitychange',load);
  return()=>{controller.abort();clearInterval(interval);document.removeEventListener('visibilitychange',load);};
 },[refreshToken,retry]);

 return <section className={styles.card} aria-labelledby="inventory-summary-title">
  <div className={styles.heading}>
   <div><h2 id="inventory-summary-title"><Package size={17} aria-hidden="true"/>Inventario</h2><p>Pares · Estado actual</p></div>
   <Link href="/inventario" aria-label="Ver inventario completo">Ver inventario<ArrowUpRight size={16} aria-hidden="true"/></Link>
  </div>
  <dl className={styles.counts} aria-busy={!counts&&!error}>
   <div><dt>En tienda</dt><dd>{counts?number.format(counts.inShop):'—'}</dd></div>
   <div><dt>En proceso</dt><dd>{counts?number.format(counts.processing):'—'}</dd></div>
   <div className={styles.ready}><dt>Listos</dt><dd>{counts?number.format(counts.ready):'—'}</dd></div>
  </dl>
  {error?<p className={styles.status} role="status">{counts?'No se pudo actualizar. Se muestran los últimos datos.':'Inventario no disponible.'}<button onClick={()=>setRetry(n=>n+1)}>Reintentar</button></p>:!counts?<p className={styles.status} role="status">Consultando inventario…</p>:null}
 </section>;
}
