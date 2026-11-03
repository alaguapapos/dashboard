import {Pool,type PoolClient} from 'pg';
import {randomBytes,randomInt,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {rootCertificates} from 'node:tls';
import {SUPABASE_CA} from './supabase-ca.ts';
import {PersonnelError} from './errors.ts';
import {RATES,type Worker,type WorkerRole,type Shift,type Audit} from './types.ts';
import {payroll,dayStart,validateRange,payPeriods} from './payroll.ts';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
function fail(message:string,status=400):never{throw new PersonnelError(message,status);}
function pinHash(pin:string,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(pin,salt,64).toString('hex');}
const dummyHash=pinHash('invalid');
const publicColumns='id,name,username,role,active,CASE WHEN pin_hash IS NULL THEN 0 ELSE 1 END AS has_pin';
export function createPersonnelPool(connectionString:string){
 const url=new URL(connectionString);
 // URL SSL options override pg's explicit TLS configuration. Always verify the host and CA.
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
 const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true,ca:[...rootCertificates,SUPABASE_CA]},max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true});
 pool.on('error',()=>console.error('Personnel database connection interrupted.'));
 return pool;
}
// A shared transaction lock serializes this small team's attendance/auth mutations across
// serverless instances. Reads use the same lock to return a consistent payroll snapshot.
export async function runPersonnel<T>(pool:Pool,fn:(store:PostgresPersonnelStore)=>Promise<T>):Promise<T>{
 const client=await pool.connect();
 try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='15s'");await client.query("SET LOCAL lock_timeout='10s'");await client.query("SELECT pg_advisory_xact_lock(174663,1)");const result=await fn(new PostgresPersonnelStore(client));await client.query('COMMIT');return result;}
 catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export class PostgresPersonnelStore {
 client:PoolClient;
 constructor(client:PoolClient){this.client=client;}
 async rows<T>(sql:string,params:unknown[]=[]):Promise<T[]>{const result=await this.client.query(sql,params);return result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?v.toISOString():v]))) as T[];}
 async workers(){return this.rows<Worker>(`SELECT ${publicColumns} FROM personnel.workers ORDER BY active DESC,name`);}
 async worker(id:string){return (await this.rows<Worker>(`SELECT ${publicColumns} FROM personnel.workers WHERE id=$1`,[id]))[0];}
 async current(id:string){return (await this.rows<Shift>('SELECT * FROM personnel.shifts WHERE worker_id=$1 AND ended_at IS NULL',[id]))[0]??null;}
 async saveWorker(input:{id?:string;name:string;username:string;role:WorkerRole;active:boolean}){
  const name=String(input?.name??'').trim(),username=String(input?.username??'').trim().toLowerCase();
  if(!name||name.length>80||!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)||!Object.hasOwn(RATES,input?.role)||typeof input?.active!=='boolean')fail('Revisa el nombre, tipo y usuario (3–40 letras sin acentos, números, puntos o guiones).');
  const old=input.id?await this.worker(input.id):undefined;if(input.id&&!old)fail('Trabajador no encontrado.',404);
  if(old&&await this.current(old.id)&&(old.role!==input.role||!input.active))fail('Registra la salida antes de cambiar el tipo o desactivar al trabajador.');
  if((await this.rows('SELECT id FROM personnel.workers WHERE username=$1 AND id<>$2',[username,input.id??''])).length)fail('Ese usuario ya existe.');
  const id=input.id??randomUUID();
  if(old)await this.client.query('UPDATE personnel.workers SET name=$1,username=$2,role=$3,active=$4 WHERE id=$5',[name,username,input.role,Number(input.active),id]);
  else await this.client.query('INSERT INTO personnel.workers(id,name,username,role,active) VALUES($1,$2,$3,$4,$5)',[id,name,username,input.role,Number(input.active)]);
  if(!input.active||old?.username!==username)await this.client.query('DELETE FROM personnel.sessions WHERE worker_id=$1',[id]);
  return (await this.worker(id))!;
 }
 async resetPin(id:string){
  const worker=await this.worker(id);if(!worker)fail('Trabajador no encontrado.',404);if(!worker.active)fail('Activa al trabajador antes de crear su acceso.');
  const pin=String(randomInt(1000,10000));await this.client.query('UPDATE personnel.workers SET pin_hash=$1 WHERE id=$2',[pinHash(pin),id]);
  await this.client.query('DELETE FROM personnel.sessions WHERE worker_id=$1',[id]);await this.client.query('DELETE FROM personnel.attempts WHERE username=$1',['user:'+worker.username]);return {username:worker.username,pin};
 }
 async attempt(key:string,now:number,limit:number){
  const row=(await this.rows<{count:number;until_ms:number}>('SELECT count,until_ms FROM personnel.attempts WHERE username=$1',[key]))[0];
  if(row&&row.until_ms>now&&row.count>=limit)return false;
  await this.client.query('INSERT INTO personnel.attempts(username,count,until_ms) VALUES($1,1,$2) ON CONFLICT(username) DO UPDATE SET count=CASE WHEN personnel.attempts.until_ms>$3 THEN personnel.attempts.count+1 ELSE 1 END,until_ms=CASE WHEN personnel.attempts.until_ms>$3 THEN personnel.attempts.until_ms ELSE $2 END',[key,now+15*60000,now]);return true;
 }
 // Return expected auth failures, instead of throwing, so failed-attempt counters commit.
 async login(username:string,pin:string,network='unknown',now=Date.now()):Promise<string|PersonnelError>{
  username=String(username??'').trim().toLowerCase();pin=String(pin??'');
  if(username.length>40||pin.length>32)return new PersonnelError('Usuario o PIN incorrectos.',401);
  await this.client.query('DELETE FROM personnel.attempts WHERE until_ms<$1',[now]);await this.client.query('DELETE FROM personnel.sessions WHERE expires<$1',[now]);
  if(!await this.attempt('network:'+digest(network),now,60)||!await this.attempt('user:'+username,now,5))return new PersonnelError('Demasiados intentos. Espera 15 minutos o pide un nuevo PIN.',429);
  const record=(await this.rows<{id:string;pin_hash:string|null;active:number}>('SELECT id,pin_hash,active FROM personnel.workers WHERE username=$1',[username]))[0];
  const [salt,key]=(record?.pin_hash??dummyHash).split(':');const valid=timingSafeEqual(scryptSync(pin,salt,64),Buffer.from(key,'hex'));
  if(!valid||!record?.active||!record.pin_hash)return new PersonnelError('Usuario o PIN incorrectos.',401);
  await this.client.query('DELETE FROM personnel.attempts WHERE username=$1',['user:'+username]);
  const token=randomBytes(32).toString('base64url');await this.client.query('INSERT INTO personnel.sessions VALUES($1,$2,$3)',[digest(token),record.id,now+12*3600000]);return token;
 }
 async kioskClock(workerId:string,pin:string,operation:'in'|'out',requestId:string,network='unknown'){
  if(!['in','out'].includes(operation)||! /^[a-zA-Z0-9-]{16,80}$/.test(requestId))return new PersonnelError('Selecciona entrada o salida.');
  const worker=await this.worker(workerId);
  const token=await this.login(worker?.username??'unknown-worker',pin,network);
  if(token instanceof PersonnelError)return token;
  await this.logout(token); // PIN authenticates this action only; no session survives.
  if(!worker)return new PersonnelError('Usuario o PIN incorrectos.',401);
  const previous=(await this.rows<{worker_id:string;operation:string;shift_id:string}>('SELECT worker_id,operation,shift_id FROM personnel.clock_requests WHERE request_id=$1',[requestId]))[0];
  let shift:Shift;
  if(previous){
   if(previous.worker_id!==worker.id||previous.operation!==operation)return new PersonnelError('Actualiza la página e intenta de nuevo.',409);
   shift=(await this.rows<Shift>('SELECT * FROM personnel.shifts WHERE id=$1',[previous.shift_id]))[0];
  }else{
   const open=await this.current(worker.id);
   if(operation==='in'&&open)return new PersonnelError('Ya tienes una entrada registrada. Selecciona salida al terminar.',409);
   if(operation==='out'&&!open)return new PersonnelError('No tienes una entrada activa. Selecciona entrada para comenzar.',409);
   shift=await this.clock(worker.id,operation,operation==='out'?open!.id:requestId);
   await this.client.query('INSERT INTO personnel.clock_requests(request_id,worker_id,operation,shift_id) VALUES($1,$2,$3,$4)',[requestId,worker.id,operation,shift.id]);
  }
  return {name:worker.name,operation,at:operation==='in'?shift.started_at:shift.ended_at};
 }
 async session(token:string,now=Date.now()){
  const row=(await this.rows<{worker_id:string}>('SELECT worker_id FROM personnel.sessions WHERE token_hash=$1 AND expires>$2',[digest(token),now]))[0];
  const worker=row?await this.worker(row.worker_id):undefined;return worker?.active?worker:null;
 }
 async logout(token:string){await this.client.query('DELETE FROM personnel.sessions WHERE token_hash=$1',[digest(token)]);}
 async clock(id:string,action:'in'|'out',requestId:string,now=new Date().toISOString()){
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))fail('Identificador de registro inválido.');
  const worker=await this.worker(id);if(!worker?.active)fail('Acceso no disponible.',401);
  if(action==='in'){
   const duplicate=(await this.rows<Shift>('SELECT * FROM personnel.shifts WHERE request_id=$1 AND worker_id=$2',[requestId,id]))[0];if(duplicate)return duplicate;
   const open=await this.current(id);if(open)return open;
   if((await this.rows('SELECT id FROM personnel.shifts WHERE worker_id=$1 AND ended_at>$2',[id,now])).length)fail('Hay un registro posterior a esta hora.');
   const newId=randomUUID();await this.client.query('INSERT INTO personnel.shifts VALUES($1,$2,$3,$4,$5,NULL,$6)',[newId,id,worker.role,RATES[worker.role],now,requestId]);return (await this.current(id))!;
  }
  const shift=(await this.rows<Shift>('SELECT * FROM personnel.shifts WHERE id=$1 AND worker_id=$2',[requestId,id]))[0];if(!shift)fail('Turno no encontrado. Actualiza la página.',409);if(shift.ended_at)return shift;
  if(Date.parse(now)<=Date.parse(shift.started_at))fail('Espera un momento antes de registrar la salida.');
  await this.client.query('UPDATE personnel.shifts SET ended_at=$1 WHERE id=$2',[now,shift.id]);return {...shift,ended_at:now};
 }
 async history(id:string){return this.rows<Shift>('SELECT * FROM personnel.shifts WHERE worker_id=$1 ORDER BY started_at DESC LIMIT 50',[id]);}
 async range(from:string,to:string){return this.rows<Shift>('SELECT * FROM personnel.shifts WHERE started_at<$1 AND (ended_at IS NULL OR ended_at>$2) ORDER BY started_at DESC',[new Date(dayStart(to)+86400000).toISOString(),new Date(dayStart(from)).toISOString()]);}
 async report(from:string,to:string,now=new Date().toISOString()){
  try{validateRange(from,to);}catch(e){fail((e as Error).message);}
  const periods=payPeriods(now);
  const estimate=async(a:string,b:string)=>{const records=await this.range(a,b);const completed=payroll(records,a,b);const live=payroll(records.map(s=>s.ended_at?s:{...s,ended_at:now}),a,b);return {from:a,to:b,days:live,completedCents:completed.reduce((n,d)=>n+d.cents,0),liveCents:live.reduce((n,d)=>n+d.cents,0),openCount:records.filter(s=>!s.ended_at).length};};
  const shifts=await this.range(from,to);
  return {workers:await this.workers(),shifts,active:await this.rows<Shift>('SELECT * FROM personnel.shifts WHERE ended_at IS NULL'),days:payroll(shifts,from,to),week:await estimate(periods.weekFrom,periods.weekTo),month:await estimate(periods.monthFrom,periods.monthTo),audit:await this.rows<Audit>('SELECT * FROM personnel.audit ORDER BY id DESC LIMIT 100'),now};
 }
 async correct(id:string,start:string,end:string,reason:string,actor:string,now=Date.now()){
  const a=Date.parse(start),b=Date.parse(end);reason=String(reason??'').trim();
  if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b||b>now||a<Date.parse('2026-01-01')||reason.length<5||reason.length>500)fail('Revisa las horas (sin fechas futuras) y escribe un motivo de al menos 5 caracteres.');
  start=new Date(a).toISOString();end=new Date(b).toISOString();
  const shift=(await this.rows<Shift>('SELECT * FROM personnel.shifts WHERE id=$1',[id]))[0];if(!shift)fail('Turno no encontrado.',404);
  if((await this.rows('SELECT id FROM personnel.shifts WHERE worker_id=$1 AND id<>$2 AND started_at<$3 AND (ended_at IS NULL OR ended_at>$4)',[shift.worker_id,id,end,start])).length)fail('Las horas se superponen con otro turno de este trabajador.');
  const updated={...shift,started_at:start,ended_at:end};await this.client.query('UPDATE personnel.shifts SET started_at=$1,ended_at=$2 WHERE id=$3',[start,end,id]);
  await this.client.query('INSERT INTO personnel.audit(shift_id,actor,reason,before_json,after_json,created_at) VALUES($1,$2,$3,$4,$5,$6)',[id,actor,reason,JSON.stringify(shift),JSON.stringify(updated),new Date(now).toISOString()]);return updated;
 }
}
