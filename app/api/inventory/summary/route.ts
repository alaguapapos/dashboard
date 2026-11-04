import {authorize} from '@/lib/server/auth';
import {withPersonnel,personnelJson,personnelError} from '@/lib/server/personnel';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
 try{
  const denied=await authorize();
  if(denied)return denied;
  // Count pairs, not whole orders. Delivered pairs no longer belong to stock.
  const counts=await withPersonnel(async store=>(await store.rows<{
   inShop:number;processing:number;ready:number;
  }>(`SELECT
    count(*) FILTER (WHERE pair->>'status' IN ('received','ready'))::int AS "inShop",
    count(*) FILTER (WHERE pair->>'status'='received')::int AS processing,
    count(*) FILTER (WHERE pair->>'status'='ready')::int AS ready
   FROM personnel.inventory_orders
   CROSS JOIN LATERAL jsonb_array_elements(document->'pairs') AS pair`))[0]);
  return personnelJson({...counts,updatedAt:new Date().toISOString()});
 }catch(error){return personnelError(error);}
}
