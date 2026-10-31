import { authorize } from '@/lib/server/auth';
export const maxDuration=60;
import {payments} from '@/lib/data/clip';

import {readArchive,archiveState} from '@/lib/server/clip-archive';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const denied=await authorize();if(denied)return denied;
 const q=new URL(request.url).searchParams,from=q.get('from')??'',to=q.get('to')??'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>to||(Date.parse(to)-Date.parse(from))/86400000>366)return Response.json({error:'Selecciona un periodo válido de hasta un año.'},{status:400});
 const token=process.env.CLIP_TOKEN;
 const sources=await Promise.allSettled([
 token?payments(from,to,token):Promise.reject(Error('Falta configurar CLIP_TOKEN en el servidor.')),
 readArchive().then(reports=>reports.map(r=>r.summary).filter(s=>s.date>=from&&s.date<=to))
 ]);
 const out:any={updatedAt:new Date().toISOString(),from,to};['clip','settlements'].forEach((key,i)=>{const r=sources[i];out[key]=r.status==='fulfilled'?{ok:true,data:r.value}:{ok:false,error:r.reason?.message??'No disponible'};});
 out.archive=await archiveState().catch(()=>null);
 return Response.json(out,{headers:{'Cache-Control':'private, no-store'}});
}
