import {env} from 'cloudflare:workers';
import {validateExpense,receiptType} from '@/lib/data/expense-validation';
export const dynamic='force-dynamic';
const db=()=> (env as unknown as {DB:D1Database}).DB;
const bucket=()=> (env as unknown as {BUCKET:R2Bucket}).BUCKET;
const headers={'Cache-Control':'private, no-store'};
export async function GET(){try{const r=await db().prepare('SELECT id,date,category,description,cents,method,cash_source,spent_by,receipt_name,created_at,updated_at,CASE WHEN receipt_key IS NOT NULL THEN 1 ELSE 0 END AS has_receipt FROM expenses ORDER BY date DESC, created_at DESC').all();return Response.json(r.results,{headers});}catch{return Response.json({error:'No se pudieron cargar los egresos.'},{status:503,headers});}}
// Sites authenticates the owner before these private routes, including receipt downloads.
export async function POST(req:Request){
 if(req.headers.get('Origin')!==new URL(req.url).origin)return Response.json({error:'Origen no autorizado.'},{status:403});
 let uploaded:string|null=null;
 try{
  if(Number(req.headers.get('Content-Length'))>11*1024*1024)return Response.json({error:'El ticket debe ser menor a 10 MB.'},{status:413});
  const multipart=req.headers.get('Content-Type')?.includes('multipart/form-data');
  const form=multipart?await req.formData():null;
  const e:any=form?JSON.parse(String(form.get('expense'))):await req.json();
  const file=form?.get('receipt');const receipt=file instanceof File&&file.size>0?file:null;
  e.cash_source??='unknown';
  if(typeof e.id!=='string')throw Error('Datos inválidos.');
  const existing=await db().prepare('SELECT receipt_key,receipt_name,receipt_type FROM expenses WHERE id=?').bind(e.id).first<{receipt_key:string|null;receipt_name:string|null;receipt_type:string|null}>();
  const error=validateExpense(e,!!receipt||!!existing?.receipt_key);if(error)return Response.json({error},{status:400});
  let key=existing?.receipt_key??null,name=existing?.receipt_name??null,type=existing?.receipt_type??null;
  if(receipt){
   if(receipt.size>10*1024*1024)return Response.json({error:'El ticket debe ser menor a 10 MB.'},{status:413});
   const bytes=new Uint8Array(await receipt.arrayBuffer());type=receiptType(bytes);
   if(!type)return Response.json({error:'Adjunta una foto JPG, PNG o WebP, o un PDF.'},{status:400});
   key='receipts/'+crypto.randomUUID();name=receipt.name.slice(0,180);uploaded=key;
   await bucket().put(key,bytes,{httpMetadata:{contentType:type}});
  }
  const now=new Date().toISOString();await db().prepare('INSERT INTO expenses (id,date,category,description,cents,method,cash_source,spent_by,receipt_key,receipt_name,receipt_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,category=excluded.category,description=excluded.description,cents=excluded.cents,method=excluded.method,cash_source=excluded.cash_source,spent_by=excluded.spent_by,receipt_key=excluded.receipt_key,receipt_name=excluded.receipt_name,receipt_type=excluded.receipt_type,updated_at=excluded.updated_at').bind(e.id,e.date,e.category,e.description.trim(),e.cents,e.method,e.cash_source,e.spent_by?.trim()||null,key,name,type,now,now).run();
  uploaded=null;
  // Superseded files can be removed after the expense safely points to the new receipt.
  if(existing?.receipt_key&&existing.receipt_key!==key)await bucket().delete(existing.receipt_key).catch(()=>{});
  return Response.json({ok:true},{headers});
 }catch{if(uploaded)await bucket().delete(uploaded).catch(()=>{});return Response.json({error:'No se guardó el egreso. Revisa los datos y el ticket e intenta de nuevo.'},{status:400});}
}
export async function DELETE(req:Request){if(req.headers.get('Origin')!==new URL(req.url).origin)return Response.json({error:'Origen no autorizado.'},{status:403});try{const {id}=await req.json() as {id:unknown};if(typeof id!=='string')throw Error();const existing=await db().prepare('SELECT receipt_key FROM expenses WHERE id=?').bind(id).first<{receipt_key:string|null}>();await db().prepare('DELETE FROM expenses WHERE id=?').bind(id).run();if(existing?.receipt_key)await bucket().delete(existing.receipt_key).catch(()=>{});return Response.json({ok:true},{headers});}catch{return Response.json({error:'No se pudo eliminar.'},{status:400});}}
