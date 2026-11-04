import {sameOrigin} from '@/lib/server/auth';
import {inventoryActor} from '@/lib/server/inventory';
import {withPersonnel,personnelJson,personnelError} from '@/lib/server/personnel';
import {InventoryStore} from '@/lib/inventory/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{const actor=await inventoryActor(request);if(!actor)return personnelJson({error:'Selecciona tu nombre e ingresa tu PIN.'},401);const id=new URL(request.url).searchParams.get('id');return personnelJson(await withPersonnel(async s=>{const store=new InventoryStore(s);return id?{order:await store.get(id),events:await store.events(id),actor}:{orders:await store.list(),actor};}));}catch(e){return personnelError(e);}}
export async function POST(request:Request){if(!sameOrigin(request))return personnelJson({error:'Origen no permitido.'},403);try{const actor=await inventoryActor(request);if(!actor)return personnelJson({error:'Tu acceso terminó. Ingresa tu PIN de nuevo.'},401);const raw=await request.json();return personnelJson(await withPersonnel(s=>new InventoryStore(s).mutate(raw,actor.name,actor.admin)));}catch(e){return personnelError(e);}}
