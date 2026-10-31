import {createServerClient} from '@supabase/ssr';
import {NextResponse} from 'next/server';
export async function GET(request:Request){
 const url=new URL(request.url),token_hash=url.searchParams.get('token_hash'),type=url.searchParams.get('type');
 const response=NextResponse.redirect(new URL('/account',request.url));
 response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');
 if(!token_hash||type!=='recovery'||!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return NextResponse.redirect(new URL('/login',request.url));
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>[],setAll(values){values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const {error}=await client.auth.verifyOtp({token_hash,type:'recovery'});return error?NextResponse.redirect(new URL('/login',request.url)):response;
}
