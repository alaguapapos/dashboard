// Only an opaque change marker is stored; never worker/customer data or a PIN.
export const WORKER_CHANGE_KEY='alagua-worker-change';
let ending:Promise<void>|null=null;
export function announceWorkerChange(){try{localStorage.setItem(WORKER_CHANGE_KEY,crypto.randomUUID());}catch{/* Storage may be blocked; server session checks still apply. */}}
export function clearWorkerSession(){
 if(ending)return ending;
 ending=(async()=>{const r=await fetch('/api/inventory/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'}),cache:'no-store'});if(!r.ok)throw Error('No se pudo cerrar el acceso anterior. Revisa tu conexión e intenta de nuevo.');announceWorkerChange();})().finally(()=>{ending=null;});
 return ending;
}
