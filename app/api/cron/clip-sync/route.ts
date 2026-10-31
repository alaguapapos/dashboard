import {timingSafeEqual} from 'node:crypto';
import {syncArchive} from '@/lib/server/clip-archive';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,actual=Buffer.from(request.headers.get('authorization')??''),expected=Buffer.from('Bearer '+secret);
 if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected))return Response.json({error:'Unauthorized'},{status:401});
 try{const state=await syncArchive(true);return Response.json({ok:!state.error,...state},{status:state.error?503:200,headers:{'Cache-Control':'no-store'}});}catch{return Response.json({ok:false,error:'No se pudo sincronizar el archivo.'},{status:503});}
}
