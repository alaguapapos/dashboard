import 'server-only';
import {createClient} from '@supabase/supabase-js';
export const BUCKET='expense-receipts';
export function admin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw Error('Storage is not configured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
