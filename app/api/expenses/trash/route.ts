import {currentUser,sameOrigin} from '@/lib/server/auth';
import {withPersonnel,personnelJson,personnelError} from '@/lib/server/personnel';
import {changeExpenseState} from '@/lib/data/expense-recovery';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await currentUser();if(!user)return personnelJson({error:'Inicia sesión.'},401);
 if(!sameOrigin(request))return personnelJson({error:'Origen no autorizado.'},403);
 try{const raw=await request.json();return personnelJson(await withPersonnel(s=>changeExpenseState(s,raw,user.email!,'restore')));}catch(error){return personnelError(error);}
}
