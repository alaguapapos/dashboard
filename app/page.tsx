import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/server/auth';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}){if(!await currentUser())redirect('/login');const {view}=await searchParams;return <Dashboard initialView={view&&['Resumen','Ventas','Egresos','Depósitos'].includes(view)?view:'Resumen'}/>;}
