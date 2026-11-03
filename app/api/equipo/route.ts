import {cookies} from 'next/headers';
import {sameOrigin} from '@/lib/server/auth';
import {withPersonnel,personnelJson,personnelError,WORKER_COOKIE} from '@/lib/server/personnel';
import {PersonnelError} from '@/lib/personnel/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{const token=(await cookies()).get(WORKER_COOKIE)?.value??'';return personnelJson(await withPersonnel(async s=>{const worker=await s.session(token);if(!worker)throw new PersonnelError('Inicia sesión para registrar tu jornada.',401);return {worker,current:await s.current(worker.id),shifts:await s.history(worker.id),now:new Date().toISOString()};}));}catch(e){return personnelError(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return personnelJson({error:'Origen no permitido.'},403);
 try{const body=await request.json(),jar=await cookies();const token=jar.get(WORKER_COOKIE)?.value??'';
  if(body.action==='login'){const newToken=await withPersonnel(s=>s.login(body.username,body.pin,process.env.VERCEL?(request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()??'unknown'):'local'));if(newToken instanceof PersonnelError)throw newToken;jar.set(WORKER_COOKIE,newToken,{httpOnly:true,sameSite:'strict',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:12*3600});return personnelJson({ok:true});}
  if(body.action==='logout'){await withPersonnel(s=>s.logout(token));jar.delete(WORKER_COOKIE);return personnelJson({ok:true});}
  if(body.action!=='in'&&body.action!=='out')throw new PersonnelError('Acción no válida.');
  const result=await withPersonnel(async s=>{const worker=await s.session(token);if(!worker)throw new PersonnelError('Tu sesión terminó. Inicia sesión de nuevo.',401);return s.clock(worker.id,body.action,String(body.requestId??''));});return personnelJson(result);
 }catch(e){return personnelError(e);}
}
