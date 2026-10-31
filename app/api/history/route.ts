import { authorize } from '@/lib/server/auth';
export const maxDuration=60;
import {parseWorkbook} from '@/lib/data/workbook';
export const dynamic='force-dynamic';
export async function GET(){const denied=await authorize();if(denied)return denied;try{const sheetId=process.env.GOOGLE_SHEET_ID;if(!sheetId)return Response.json({error:'El histórico de Google Sheets no está configurado.'},{status:503});const r=await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=xlsx`,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error();const b=await r.arrayBuffer();if(b.byteLength>5_000_000)throw Error();return Response.json(parseWorkbook(b),{headers:{'Cache-Control':'private, no-store'}});}catch{return Response.json({error:'No se pudo leer el archivo histórico.'},{status:502});}}
