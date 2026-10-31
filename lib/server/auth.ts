import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function currentUser(){
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return null;
 const jar=await cookies();
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>jar.getAll(),setAll(values){try{values.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Server components cannot refresh cookies. */}}}});
 const {data:{user},error}=await client.auth.getUser();
 const allowed=(process.env.DASHBOARD_ALLOWED_EMAILS||'').toLowerCase().split(',').map(s=>s.trim());
 return !error&&user?.email_confirmed_at&&user.email&&allowed.includes(user.email.toLowerCase())?user:null;
}
export async function authorize(){return await currentUser()?null:Response.json({error:'Inicia sesión para consultar el negocio.'},{status:401,headers:{'Cache-Control':'private, no-store'}});}
export function sameOrigin(request:Request){try{const value=request.headers.get('origin');if(!value)return false;const origin=new URL(value);return origin.host===request.headers.get('host')&&origin.protocol===new URL(request.url).protocol;}catch{return false;}}
