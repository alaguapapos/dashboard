import {authorize} from '@/lib/server/auth';
export async function GET(){return await authorize()??Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});}
