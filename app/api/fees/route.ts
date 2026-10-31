import {env} from 'cloudflare:workers';
import {clipGet} from '@/lib/data/clip';
import {reportedFee,settlementPath,type ReportedFee} from '@/lib/data/fees';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 const q=new URL(request.url).searchParams,from=q.get('from')??'',to=q.get('to')??'';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>to||to>today)return Response.json({ok:false,error:'Periodo inválido.'},{status:400,headers});
 try{
  const token=(env as unknown as {CLIP_TOKEN?:string}).CLIP_TOKEN;if(!token)throw Error('Falta configurar Clip.');
  if(from<new Date(Date.now()-88*86400000).toISOString().slice(0,10))throw Error('Clip solo permite consultar los desgloses de depósitos recientes.');
  // Search through today: a selected sale may have been deposited on a later date.
  const list=await clipGet('settlements?'+new URLSearchParams({from,to:today}),token,'x-api-key');
  if(!Array.isArray(list.settlements))throw Error('Respuesta de liquidaciones inesperada.');
  const data:Record<string,ReportedFee>={};let cursor=0,failures=0;
  await Promise.all(Array.from({length:Math.min(4,list.settlements.length)},async()=>{
   while(cursor<list.settlements.length){const settlement=list.settlements[cursor++];
    try{
     let path=settlementPath(settlement.links?.self?.href);path+=(path.includes('?')?'&':'?')+'page_size=100';
     const visited=new Set<string>();const local:Record<string,ReportedFee>={};
     while(path){
      if(visited.has(path)||visited.size>=100)throw Error('Paginación incompleta.');visited.add(path);
      const report=await clipGet(path,token,'x-api-key');
      if(!Array.isArray(report.settlement?.details))throw Error('Desglose incompleto.');
      for(const day of report.settlement.details){if(!Array.isArray(day.payments))throw Error('Desglose incompleto.');for(const p of day.payments){const date=p.payment_date??day.date;if(date>=from&&date<=to){if(typeof p.receipt_no!=='string')throw Error('Recibo incompleto.');local[p.receipt_no]=reportedFee(p,settlement.disbursement_date);}}}
      path=report.links?.next?.href?settlementPath(report.links.next.href):'';
     }
     for(const [id,fee] of Object.entries(local)){if(data[id]&&JSON.stringify(data[id])!==JSON.stringify(fee))throw Error('Recibo en múltiples liquidaciones.');data[id]=fee;}
    }catch{failures++;}
   }
  }));
  return Response.json({ok:true,data,partial:failures>0,updatedAt:new Date().toISOString()},{headers});
 }catch(e){return Response.json({ok:false,error:e instanceof Error?e.message:'No se pudieron consultar las comisiones.'},{status:503,headers});}
}
