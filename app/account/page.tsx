import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/server/auth';
import Password from './password';
export const dynamic='force-dynamic';
export default async function Page(){if(!await currentUser())redirect('/login');return <Password/>;}
