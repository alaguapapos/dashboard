import { authorize } from '@/lib/server/auth';
export const maxDuration=60;
import {payments,clipGet} from '@/lib/data/clip';

export const dynamic='force-dynamic';
export async function GET(request:Request){
 const denied=await authorize();if(denied)return denied;
 const q=new URL(request.url).searchParams,from=q.get('from')??'',to=q.get('to')??'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>to||(Date.parse(to)-Date.parse(from))/86400000>366)return Response.json({error:'Selecciona un periodo válido de hasta un año.'},{status:400});
 const token=process.env.CLIP_TOKEN;
 const sources=await Promise.allSettled([
 token?payments(from,to,token):Promise.reject(Error('Falta configurar CLIP_TOKEN en el servidor.')),
 (async()=>{if(!token)throw Error('Falta configurar Clip.');const earliest=new Date(Date.now()-88*86400000).toISOString().slice(0,10);if(from<earliest)throw Error('Clip limita depósitos a los últimos 90 días. Selecciona un periodo reciente.');const r=await clipGet(`settlements?${new URLSearchParams({from,to})}`,token,'x-api-key');if(!Array.isArray(r.settlements))throw Error('Respuesta de depósitos inesperada.');return r.settlements.map((s:any)=>({date:s.disbursement_date,id:s.settlement_report_id,gross:s.gross_amount,fee:s.total_fee,tax:s.total_tax,retention:s.total_retention,net:s.disbursed_net_amount,count:s.total_transactions}));})()
 ]);
 const out:any={updatedAt:new Date().toISOString(),from,to};['clip','settlements'].forEach((key,i)=>{const r=sources[i];out[key]=r.status==='fulfilled'?{ok:true,data:r.value}:{ok:false,error:r.reason?.message??'No disponible'};});
 return Response.json(out,{headers:{'Cache-Control':'private, no-store'}});
}
