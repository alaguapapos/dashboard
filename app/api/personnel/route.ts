import {currentUser,sameOrigin} from '@/lib/server/auth';
import {withPersonnel,personnelJson,personnelError} from '@/lib/server/personnel';
import {PersonnelError} from '@/lib/personnel/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await currentUser())return personnelJson({error:'Inicia sesión como administrador.'},401);
 try{const url=new URL(request.url);return personnelJson(await withPersonnel(s=>s.report(url.searchParams.get('from')??'',url.searchParams.get('to')??'')));}catch(e){return personnelError(e);}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return personnelJson({error:'Origen no permitido.'},403);
 const user=await currentUser();if(!user)return personnelJson({error:'Inicia sesión como administrador.'},401);
 try{const body=await request.json();const result=await withPersonnel(async s=>{
  if(body.action==='save')return s.saveWorker(body.worker);
  if(body.action==='pin')return s.resetPin(String(body.id??''));
  if(body.action==='correct')return s.correct(String(body.id??''),String(body.start??''),String(body.end??''),String(body.reason??''),user.email!);
  throw new PersonnelError('Acción no válida.');
 });return personnelJson(result);}catch(e){return personnelError(e);}
}
