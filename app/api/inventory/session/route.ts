import {createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {sameOrigin} from '@/lib/server/auth';
import {INVENTORY_COOKIE} from '@/lib/server/inventory';
import {withPersonnel,personnelJson,personnelError,WORKER_COOKIE} from '@/lib/server/personnel';
import {PersonnelError} from '@/lib/personnel/errors';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return personnelJson({error:'Origen no permitido.'},403);
 try{const body=await request.json();const jar=await cookies();const old=jar.get(INVENTORY_COOKIE)?.value;
 const legacy=jar.get(WORKER_COOKIE)?.value;
 if(old||legacy)await withPersonnel(async s=>{if(old)await s.logout(old);if(legacy)await s.logout(legacy);});
 jar.delete(INVENTORY_COOKIE);jar.delete(WORKER_COOKIE);
 if(body.action==='logout')return personnelJson({ok:true});
 const result=await withPersonnel(async s=>{const worker=await s.worker(String(body.workerId??''));const token=await s.login(worker?.username??'unknown-worker',String(body.pin??''),request.headers.get('x-forwarded-for')??'unknown');if(token instanceof PersonnelError)return token;
 // Inventory access expires after 20 minutes, independent of the shared clock.
 await s.client.query('UPDATE personnel.sessions SET expires=$1 WHERE token_hash=$2',[Date.now()+20*60000,createHash('sha256').update(token).digest('hex')]);return token;});
 if(result instanceof PersonnelError)return personnelError(result);
 jar.set(INVENTORY_COOKIE,result,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:20*60});return personnelJson({ok:true});
 }catch(e){return personnelError(e);}
}
