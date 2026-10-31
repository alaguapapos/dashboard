import {currentUser,sameOrigin} from '@/lib/server/auth';
import {admin,BUCKET} from '@/lib/server/storage';
export async function POST(request:Request){
 const user=await currentUser();if(!user)return Response.json({error:'Inicia sesión.'},{status:401});
 if(!sameOrigin(request))return Response.json({error:'Origen no autorizado.'},{status:403});
 try{
  const {expenseId,name,size,type}=await request.json();
  if(!/^[a-zA-Z0-9-]{10,64}$/.test(expenseId)||typeof name!=='string'||!name||name.length>180||!Number.isSafeInteger(size)||size<=0||size>10485760||!['image/jpeg','image/png','image/webp','application/pdf'].includes(type))return Response.json({error:'Adjunta un JPG, PNG, WebP o PDF de hasta 10 MB.'},{status:400});
  const db=admin(),id=crypto.randomUUID(),path='pending/'+id;
  const {error}=await db.from('receipt_uploads').insert({id,user_id:user.id,expense_id:expenseId,name,path,size,expires_at:new Date(Date.now()+15*60000).toISOString()});if(error)throw error;
  const upload=await db.storage.from(BUCKET).createSignedUploadUrl(path);if(upload.error)throw upload.error;
  return Response.json({id,path,token:upload.data.token,bucket:BUCKET},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'No se pudo preparar el ticket.'},{status:503});}
}
