import {cookies} from 'next/headers';
import {sameOrigin} from '@/lib/server/auth';
import {withPersonnel,personnelJson,personnelError,WORKER_COOKIE} from '@/lib/server/personnel';
import {PersonnelError} from '@/lib/personnel/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{return personnelJson(await withPersonnel(async s=>({workers:(await s.workers()).filter(w=>w.active).map(w=>({id:w.id,name:w.name,role:w.role}))})));}catch(e){return personnelError(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return personnelJson({error:'Origen no permitido.'},403);
 try{
  const body=await request.json();if(body?.action!=='clock')throw new PersonnelError('Selecciona tu nombre e ingresa tu PIN para registrar entrada o salida.');
  const jar=await cookies(),oldToken=jar.get(WORKER_COOKIE)?.value;jar.delete(WORKER_COOKIE);
  const result=await withPersonnel(async s=>{
   if(oldToken)await s.logout(oldToken);
   return s.kioskClock(String(body.workerId??''),String(body.pin??''),body.operation,String(body.requestId??''),process.env.VERCEL?(request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()??'unknown'):'local');
  });
  if(result instanceof PersonnelError)throw result;
  return personnelJson(result);
 }catch(e){return personnelError(e);}
}
