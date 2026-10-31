import {authorize} from '@/lib/server/auth';
import {archivedFees} from '@/lib/data/deposit-archive';
import {syncArchive,readArchive,clipToday} from '@/lib/server/clip-archive';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const denied=await authorize();if(denied)return denied;
 const headers={'Cache-Control':'private, no-store'};
 const q=new URL(request.url).searchParams,from=q.get('from')??'',to=q.get('to')??'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||from>to||to>clipToday())return Response.json({ok:false,error:'Periodo inválido.'},{status:400,headers});
 try{
  const state=await syncArchive();const reports=await readArchive();
  return Response.json({ok:true,data:archivedFees(reports,from,to),partial:!!state.error,historyLimited:false,archived:true,lastSyncedAt:state.succeeded_at,syncError:state.error,failedReports:state.failed_reports,updatedAt:new Date().toISOString()},{headers});
 }catch{return Response.json({ok:false,error:'No se pudo consultar el archivo de depósitos.'},{status:503,headers});}
}
