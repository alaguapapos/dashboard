import 'server-only';
import {admin} from './storage';
import {clipGet} from '@/lib/data/clip';
import {settlementHistory,settlementPath} from '@/lib/data/fees';
import {archivePayments,depositSummary,type ArchivedReport} from '@/lib/data/deposit-archive';
export const clipToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function archiveState(){const r=await admin().from('clip_sync_state').select('*').eq('id','deposits').maybeSingle();if(r.error)throw Error('No se pudo consultar el estado del archivo.');return r.data;}
export async function readArchive(){
 const rows:ArchivedReport[]=[];const db=admin();
 for(let offset=0;;offset+=500){const r=await db.from('clip_deposit_reports').select('payload').order('id').range(offset,offset+499);if(r.error)throw Error('No se pudo leer el archivo de depósitos.');rows.push(...r.data.map(r=>r.payload as ArchivedReport));if(r.data.length<500)break;}
 return rows;
}
export async function syncArchive(force=false){
 const db=admin(),previous=await archiveState();
 if(!force&&previous?.succeeded_at&&!previous.error&&Date.now()-Date.parse(previous.succeeded_at)<3600000)return previous;
 const lease=await db.rpc('acquire_clip_sync');if(lease.error)throw Error('No se pudo iniciar la sincronización.');if(!lease.data)return await archiveState();
 const history_from=previous?.history_from??settlementHistory('2000-01-01',clipToday()).earliest;
 const attempted_at=new Date().toISOString();let failed_reports=0,error:string|null=null;
 try{
  const token=process.env.CLIP_TOKEN;if(!token)throw Error('Falta configurar Clip.');
  const today=clipToday(),from=settlementHistory('2000-01-01',today).earliest;
  const list=await clipGet('settlements?'+new URLSearchParams({from,to:today}),token,'x-api-key');
  if(!Array.isArray(list.settlements))throw Error('Respuesta de liquidaciones inesperada.');
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,list.settlements.length)},async()=>{
   while(cursor<list.settlements.length){const s=list.settlements[cursor++];try{
    const summary=depositSummary(s),payments:ArchivedReport['payments']=[],visited=new Set<string>();
    let path=settlementPath(s.links?.self?.href);path+=(path.includes('?')?'&':'?')+'page_size=100';
    while(path){if(visited.has(path)||visited.size>=100)throw Error('Paginación incompleta.');visited.add(path);const page=await clipGet(path,token,'x-api-key');payments.push(...archivePayments(page.settlement?.details,summary.date));path=page.links?.next?.href?settlementPath(page.links.next.href):'';}
    const unique=new Map<string,typeof payments[number]>();for(const p of payments){if(unique.has(p.id)&&JSON.stringify(unique.get(p.id))!==JSON.stringify(p))throw Error('Recibo duplicado inconsistente.');unique.set(p.id,p);}
    // One atomic row per complete report. Failed pages never replace the saved report.
    const saved=await db.from('clip_deposit_reports').upsert({id:summary.id,deposit_date:summary.date,payload:{summary,payments:[...unique.values()]},synced_at:attempted_at});if(saved.error)throw Error('No se pudo guardar el depósito.');
   }catch{failed_reports++;}}
  }));
  if(failed_reports)error='No se pudieron actualizar todos los depósitos. Se conserva el archivo anterior.';
 }catch(e){error=e instanceof Error?e.message:'No se pudo sincronizar Clip.';}
 const state={id:'deposits',lock_until:null,history_from,attempted_at,succeeded_at:error?previous?.succeeded_at??null:attempted_at,failed_reports,error};
 const saved=await db.from('clip_sync_state').upsert(state);if(saved.error)throw Error('No se pudo guardar el estado de sincronización.');
 return state;
}
