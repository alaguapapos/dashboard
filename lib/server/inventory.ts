import 'server-only';
import {cookies} from 'next/headers';
import {currentUser} from './auth';
import {withPersonnel} from './personnel';
export const INVENTORY_COOKIE='alagua_inventory';
export async function inventoryActor(request?:Request){
 const access=request?.headers.get('x-inventory-access');
 // A worker screen must never inherit the owner's dashboard login.
 if(access==='owner'){const owner=await currentUser();return owner?{name:owner.email!,admin:true,id:owner.id}:null;}
 const token=(await cookies()).get(INVENTORY_COOKIE)?.value;
 if(token){const worker=await withPersonnel(s=>s.session(token));if(worker){
  const expected=request?.headers.get('x-inventory-worker');
  if(access==='worker'&&((expected&&expected!==worker.id)||(request?.method==='POST'&&!expected)))return null;
  return {name:worker.name,admin:false,id:worker.id};
 }}
 if(access==='worker')return null;
 const owner=await currentUser();return owner?{name:owner.email!,admin:true,id:owner.id}:null;
}
