import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {authorize,sameOrigin} from '@/lib/server/auth';
import {adminEmailForUsername} from '@/lib/data/admin-username';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){return await authorize()??Response.json({ok:true},{headers});}
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Origen no permitido.'},{status:403,headers});
 try{
  const body=await request.json();
  if(typeof body?.username!=='string'||typeof body.password!=='string'||body.password.length>1024)return Response.json({error:'Usuario o contraseña incorrectos.'},{status:401,headers});
  const email=adminEmailForUsername(body.username,process.env.DASHBOARD_ALLOWED_EMAILS??'');
  if(!email)return Response.json({error:'Usuario o contraseña incorrectos.'},{status:401,headers});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return Response.json({error:'Configuración pendiente.'},{status:503,headers});
  const jar=await cookies();
  const client=createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll:values=>values.forEach(({name,value,options})=>jar.set(name,value,options))}});
  const {data,error}=await client.auth.signInWithPassword({email,password:body.password});
  if(error||!data.user?.email_confirmed_at||data.user.email?.toLowerCase()!==email){if(data.session)await client.auth.signOut({scope:'local'});return Response.json({error:'Usuario o contraseña incorrectos.'},{status:401,headers});}
  return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'No se pudo iniciar sesión. Intenta de nuevo.'},{status:500,headers});}
}
