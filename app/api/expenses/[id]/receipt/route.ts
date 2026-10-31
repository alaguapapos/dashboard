import {authorize} from '@/lib/server/auth';
import {admin,BUCKET} from '@/lib/server/storage';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const denied=await authorize();if(denied)return denied;
 try{const {id}=await params,db=admin();
 const {data:row,error}=await db.from('expenses').select('receipt_key,receipt_type').eq('id',id).maybeSingle();if(error)throw error;
 if(!row?.receipt_key)return new Response('Ticket no encontrado',{status:404});
 const object=await db.storage.from(BUCKET).download(row.receipt_key);if(object.error)throw object.error;
 return new Response(object.data,{headers:{'Content-Type':row.receipt_type||'application/octet-stream','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return new Response('Ticket no disponible',{status:503});}
}
