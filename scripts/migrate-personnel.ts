// Run once with POSTGRES_URL set and Node 22. Local PIN hashes are never printed.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createPersonnelPool} from '../lib/personnel/postgres.ts';
if(!process.env.POSTGRES_URL)throw Error('POSTGRES_URL is required');
const source=resolve(process.argv[2]||'migration-data/personnel.sqlite');
const local=new DatabaseSync(source,{readOnly:true});
const pool=createPersonnelPool(process.env.POSTGRES_URL);
try{
 await pool.query(readFileSync(new URL('../supabase/personnel.sql',import.meta.url),'utf8'));
 const client=await pool.connect();
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(174663,1)');
  if((await client.query("SELECT key FROM personnel.settings WHERE key='sqlite-migration-v1'")).rowCount){await client.query('COMMIT');console.log('Personnel migration already completed. No records changed.');}
  else{
   const workers=local.prepare('SELECT * FROM workers').all();const shifts=local.prepare('SELECT * FROM shifts').all();const audit=local.prepare('SELECT * FROM audit').all();
   if((await client.query('SELECT id FROM personnel.workers LIMIT 1')).rowCount)throw Error('Destination has personnel records: review before importing.');
   mkdirSync(resolve('migration-data'),{recursive:true,mode:0o700});
   const backup=resolve('migration-data/personnel-before-supabase-'+Date.now()+'.sqlite');local.prepare('VACUUM INTO ?').run(backup);
   for(const w of workers)await client.query('INSERT INTO personnel.workers(id,name,username,role,active,pin_hash) VALUES($1,$2,$3,$4,$5,$6)',[w.id,w.name,w.username,w.role,w.active,w.pin_hash]);
   for(const s of shifts)await client.query('INSERT INTO personnel.shifts VALUES($1,$2,$3,$4,$5,$6,$7)',[s.id,s.worker_id,s.role,s.rate_cents,s.started_at,s.ended_at,s.request_id]);
   for(const a of audit)await client.query('INSERT INTO personnel.audit(id,shift_id,actor,reason,before_json,after_json,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[a.id,a.shift_id,a.actor,a.reason,a.before_json,a.after_json,a.created_at]);
   await client.query("SELECT setval(pg_get_serial_sequence('personnel.audit','id'),COALESCE((SELECT max(id) FROM personnel.audit),0)+1,false)");
   const counts={workers:workers.length,shifts:shifts.length,corrections:audit.length};
   await client.query("INSERT INTO personnel.settings VALUES('sqlite-migration-v1',$1)",[JSON.stringify({...counts,at:new Date().toISOString()})]);
   await client.query('COMMIT');console.log(JSON.stringify({migrated:counts,backupSaved:true}));
  }
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}finally{local.close();await pool.end();}
