import Login from './login';
export default function Page(){return <Login configured={!!process.env.NEXT_PUBLIC_SUPABASE_URL&&!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}/>;}
