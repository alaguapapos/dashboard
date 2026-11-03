import 'server-only';
import {createPersonnelPool,runPersonnel,type PostgresPersonnelStore} from '@/lib/personnel/postgres';
import {PersonnelError} from '@/lib/personnel/errors';
export const WORKER_COOKIE='alagua_worker';
let pool:ReturnType<typeof createPersonnelPool>|undefined;
export async function withPersonnel<T>(fn:(store:PostgresPersonnelStore)=>Promise<T>):Promise<T>{
 if(!process.env.POSTGRES_URL)throw new PersonnelError('La base de datos de personal no está configurada.',503);
 pool??=createPersonnelPool(process.env.POSTGRES_URL);
 return runPersonnel(pool,fn);
}
export function personnelJson(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});}
export function personnelError(error:unknown){if(error instanceof PersonnelError)return personnelJson({error:error.message},error.status);console.error('Personnel request failed',error instanceof Error?error.message:'Unknown error');return personnelJson({error:'No se pudo completar la operación. Intenta de nuevo.'},500);}
