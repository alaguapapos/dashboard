import {authorize,currentUser,sameOrigin} from '@/lib/server/auth';
import {admin,BUCKET} from '@/lib/server/storage';
import {withPersonnel,personnelJson,personnelError} from '@/lib/server/personnel';
import {changeExpenseState} from '@/lib/data/expense-recovery';
import {validateExpense,receiptType} from '@/lib/data/expense-validation';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const denied=await authorize();if(denied)return denied;
 try{const db=admin(),rows=[],deleted=new URL(request.url).searchParams.get('deleted')==='true';
  for(let offset=0;;offset+=1000){const query=db.from('expenses').select('id,date,category,description,cents,method,cash_source,spent_by,receipt_name,receipt_key,created_at,updated_at,deleted_at,deleted_by');const {data,error}=await (deleted?query.not('deleted_at','is',null):query.is('deleted_at',null)).order('date',{ascending:false}).order('created_at',{ascending:false}).order('id').range(offset,offset+999);if(error)throw error;rows.push(...data.map(({receipt_key,...row})=>({...row,has_receipt:receipt_key?1:0})));if(data.length<1000)break;}
  return Response.json(rows,{headers});
 }catch{return Response.json({error:'No se pudieron cargar los egresos.'},{status:503,headers});}
}
export async function POST(request:Request){
 const user=await currentUser();if(!user)return Response.json({error:'Inicia sesión.'},{status:401,headers});
 if(!sameOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403});
 try{
  const e=await request.json();e.cash_source??='unknown';
  if(typeof e.id!=='string')throw Error();
  const db=admin();const old=await db.from('expenses').select('*').eq('id',e.id).maybeSingle();if(old.error)throw old.error;
  const existing=old.data;
  if(existing?.deleted_at)return Response.json({error:'Este egreso está en Eliminados. Restáuralo antes de editarlo.'},{status:409,headers});
  if(existing&&e.expected_updated_at!==existing.updated_at)return Response.json({error:'Otro usuario actualizó este egreso. Cierra el formulario y vuelve a abrirlo antes de guardar.'},{status:409,headers});
  const invalid=validateExpense(e);if(invalid)return Response.json({error:invalid},{status:400,headers});
  let key=existing?.receipt_key??null,name=existing?.receipt_name??null,type=existing?.receipt_type??null;
  if(e.uploadId){
   const pending=await db.from('receipt_uploads').select('*').eq('id',e.uploadId).eq('user_id',user.id).eq('expense_id',e.id).gt('expires_at',new Date().toISOString()).single();if(pending.error||!pending.data)throw Error();
   const download=await db.storage.from(BUCKET).download(pending.data.path);if(download.error)throw download.error;
   const bytes=new Uint8Array(await download.data.arrayBuffer());type=receiptType(bytes);
   if(!type||bytes.length!==pending.data.size||bytes.length>10485760)return Response.json({error:'El contenido del ticket no es válido.'},{status:400,headers});
   // Final receipt has no signed upload token; pending tokens cannot overwrite it.
   key='receipts/'+crypto.randomUUID();name=pending.data.name;
   const saved=await db.storage.from(BUCKET).upload(key,bytes,{contentType:type,upsert:false});if(saved.error)throw saved.error;
  }
  const now=new Date().toISOString();
  const row={id:e.id,date:e.date,category:e.category.trim(),description:e.description.trim(),cents:e.cents,method:e.method,cash_source:e.cash_source,spent_by:e.spent_by?.trim()||null,receipt_key:key,receipt_name:name,receipt_type:type,created_at:existing?.created_at??now,updated_at:now};
  // Optimistic update prevents concurrent receipt edits from silently overwriting one another.
  const saved=existing?await db.from('expenses').update(row).eq('id',e.id).eq('updated_at',existing.updated_at).is('deleted_at',null).select('id'):await db.from('expenses').insert(row).select('id');
  if(saved.error)throw saved.error;if(!saved.data?.length)return Response.json({error:'El egreso cambió. Recarga antes de guardar.'},{status:409,headers});
  // Retain superseded objects for recovery. A separate audited cleanup can remove orphans.
  if(e.uploadId)await db.from('receipt_uploads').delete().eq('id',e.uploadId).eq('user_id',user.id);
  return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'No se pudo guardar el egreso. Revisa los datos e intenta de nuevo.'},{status:400,headers});}
}
export async function DELETE(request:Request){
 const user=await currentUser();if(!user)return personnelJson({error:'Inicia sesión.'},401);
 if(!sameOrigin(request))return personnelJson({error:'Origen no autorizado.'},403);
 try{const raw=await request.json();return personnelJson(await withPersonnel(s=>changeExpenseState(s,raw,user.email!,'delete')));}catch(error){return personnelError(error);}
}
