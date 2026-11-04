import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 // Inventory handlers authenticate their own requests and refresh owner cookies when needed.
 // Worker PIN sessions do not need a duplicate Supabase Auth network request here.
 if(request.nextUrl.pathname==='/api/inventory'||request.nextUrl.pathname.startsWith('/api/inventory/'))return response;
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return response;
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>request.cookies.getAll(),setAll(values){values.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});values.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 await client.auth.getUser();response.headers.set('Cache-Control','private, no-store');return response;
}
export const config={matcher:['/','/login','/account','/personal','/inventario','/api/:path*']};
