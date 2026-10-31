/** Read-only source export and idempotent destination import. Never deletes source data. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const directory=new URL('../migration-data/',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const mode=process.argv[2];
if(!['export','import','verify'].includes(mode))throw Error('Choose export, import, or verify.');
if(mode==='export'){
 const {SOURCE_URL,SOURCE_BEARER}=process.env;if(!SOURCE_URL||!SOURCE_BEARER)throw Error('Missing source credentials');
 const origin=new URL(SOURCE_URL);if(origin.protocol!=='https:')throw Error('HTTPS required');
 const get=async path=>{const r=await fetch(new URL(path,origin),{redirect:'error',headers:{'OAI-Sites-Authorization':'Bearer '+SOURCE_BEARER},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Source export failed: '+r.status);return r;};
 const rows=await (await get('/api/expenses')).json();if(!Array.isArray(rows))throw Error('Invalid export');
 await mkdir(directory,{recursive:true,mode:0o700});const manifest=[];
 for(const row of rows){if(!/^[a-zA-Z0-9-]{10,64}$/.test(row.id))throw Error('Invalid expense id');let receipt=null;
  if(row.has_receipt){const r=await get('/api/expenses/'+encodeURIComponent(row.id)+'/receipt');const bytes=Buffer.from(await r.arrayBuffer());receipt={file:row.id+'.receipt',sha256:hash(bytes),type:r.headers.get('content-type')};await writeFile(new URL(receipt.file,directory),bytes,{mode:0o600});}
  manifest.push({row,receipt});
 }
 await writeFile(new URL('manifest.json',directory),JSON.stringify({version:1,exportedAt:new Date().toISOString(),expenses:manifest},null,2),{mode:0o600});
 console.log(JSON.stringify({expenses:manifest.length,receipts:manifest.filter(e=>e.receipt).length}));
}else{
 const {NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;if(!NEXT_PUBLIC_SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)throw Error('Destination credentials missing');
 const db=createClient(NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),bucket=db.storage.from('expense-receipts');
 const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
 if(manifest.version!==1||!Array.isArray(manifest.expenses))throw Error('Invalid manifest');
 for(const {row,receipt} of manifest.expenses){const {has_receipt,...fields}=row;const record={...fields,receipt_key:receipt?'receipts/migrated-'+row.id+'-'+receipt.sha256:null,receipt_type:receipt?.type??null};
  const existing=await db.from('expenses').select('*').eq('id',row.id).maybeSingle();if(existing.error)throw existing.error;
  if(existing.data){for(const [key,value] of Object.entries(record))if(existing.data[key]!==value)throw Error('Destination record conflicts: '+row.id);}
  else{if(mode==='verify')throw Error('Missing destination expense: '+row.id);
   if(receipt){const bytes=await readFile(new URL(receipt.file,directory));if(hash(bytes)!==receipt.sha256)throw Error('Backup checksum failed');const old=await bucket.download(record.receipt_key);if(old.error){const uploaded=await bucket.upload(record.receipt_key,bytes,{contentType:receipt.type,upsert:false});if(uploaded.error)throw uploaded.error;}else if(hash(Buffer.from(await old.data.arrayBuffer()))!==receipt.sha256)throw Error('Destination receipt conflict');}
   const inserted=await db.from('expenses').insert(record);if(inserted.error)throw inserted.error;
  }
  if(receipt){const downloaded=await bucket.download(record.receipt_key);if(downloaded.error||hash(Buffer.from(await downloaded.data.arrayBuffer()))!==receipt.sha256)throw Error('Receipt verification failed: '+row.id);}
 }
 console.log(JSON.stringify({verifiedExpenses:manifest.expenses.length,verifiedReceipts:manifest.expenses.filter(e=>e.receipt).length}));
}
