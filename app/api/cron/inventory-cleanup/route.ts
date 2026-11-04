import {withPersonnel,personnelJson,personnelError} from '@/lib/server/personnel';
import {InventoryStore} from '@/lib/inventory/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return personnelJson({error:'No autorizado'},401);
 // Enable only after independent backups and a restore have been verified.
 if(process.env.INVENTORY_CLEANUP_ENABLED!=='true')return personnelJson({deleted:0,skipped:true,reason:'Cleanup disabled pending backup verification'});
 try{return personnelJson(await withPersonnel(s=>new InventoryStore(s).cleanup()));}catch(e){return personnelError(e);}
}
