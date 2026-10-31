import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const {DB,BUCKET}=env as unknown as {DB:D1Database;BUCKET:R2Bucket};
 const row=await DB.prepare('SELECT receipt_key,receipt_type FROM expenses WHERE id=?').bind(id).first<{receipt_key:string|null;receipt_type:string|null}>();
 if(!row?.receipt_key)return new Response('Ticket no encontrado',{status:404});
 const object=await BUCKET.get(row.receipt_key);if(!object)return new Response('Ticket no disponible',{status:404});
 return new Response(object.body,{headers:{'Content-Type':row.receipt_type||'application/octet-stream','Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
