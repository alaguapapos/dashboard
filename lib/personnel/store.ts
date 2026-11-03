import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomInt,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {RATES,type Worker,type WorkerRole,type Shift,type Audit} from './types.ts';
import {payroll,dayStart,validateRange,payPeriods} from './payroll.ts';
import {PersonnelError} from './errors.ts';
export {PersonnelError} from './errors.ts';
function fail(message:string,status=400):never{throw new PersonnelError(message,status);}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
function pinHash(pin:string,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(pin,salt,64).toString('hex');}
const publicColumns='id,name,username,role,active,CASE WHEN pin_hash IS NULL THEN 0 ELSE 1 END AS has_pin';
export class PersonnelStore {
 db:DatabaseSync;
 constructor(path:string){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS workers(id TEXT PRIMARY KEY,name TEXT NOT NULL,username TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('lavador','detallador')),active INTEGER NOT NULL DEFAULT 1,pin_hash TEXT);
   CREATE TABLE IF NOT EXISTS shifts(id TEXT PRIMARY KEY,worker_id TEXT NOT NULL REFERENCES workers(id),role TEXT NOT NULL,rate_cents INTEGER NOT NULL,started_at TEXT NOT NULL,ended_at TEXT,request_id TEXT NOT NULL UNIQUE);
   CREATE UNIQUE INDEX IF NOT EXISTS open_shift ON shifts(worker_id) WHERE ended_at IS NULL;
   CREATE INDEX IF NOT EXISTS shift_dates ON shifts(started_at,ended_at);
   CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,worker_id TEXT NOT NULL REFERENCES workers(id),expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS attempts(username TEXT PRIMARY KEY,count INTEGER NOT NULL,until_ms INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,shift_id TEXT NOT NULL,actor TEXT NOT NULL,reason TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  this.transaction(()=>{if(!this.db.prepare("SELECT key FROM settings WHERE key='seeded'").get()){
   for(const [name,role] of [['Julio','lavador'],['Emilio','lavador'],['Diego','detallador'],['Alejandro','detallador'],['Mitch','detallador']] as const)this.db.prepare('INSERT INTO workers(id,name,username,role) VALUES(?,?,?,?)').run(randomUUID(),name,name.toLowerCase(),role);
   this.db.prepare("INSERT INTO settings VALUES('seeded','1')").run();
  }});
 }
 close(){this.db.close();}
 transaction<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');return value;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 workers(){return this.db.prepare(`SELECT ${publicColumns} FROM workers ORDER BY active DESC,name`).all() as Worker[];}
 worker(id:string){return this.db.prepare(`SELECT ${publicColumns} FROM workers WHERE id=?`).get(id) as Worker|undefined;}
 current(id:string){return (this.db.prepare('SELECT * FROM shifts WHERE worker_id=? AND ended_at IS NULL').get(id) as Shift|undefined)??null;}
 saveWorker(input:{id?:string;name:string;username:string;role:WorkerRole;active:boolean}){
  const name=String(input.name??'').trim(),username=String(input.username??'').trim().toLowerCase();
  if(!name||name.length>80||! /^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)||!Object.hasOwn(RATES,input.role)||typeof input.active!=='boolean')fail('Revisa el nombre, tipo y usuario (3–40 letras sin acentos, números, puntos o guiones).');
  return this.transaction(()=>{
   const old=input.id?this.worker(input.id):undefined;if(input.id&&!old)fail('Trabajador no encontrado.',404);
   if(old&&this.current(old.id)&&(old.role!==input.role||!input.active))fail('Registra la salida antes de cambiar el tipo o desactivar al trabajador.');
   const duplicate=this.db.prepare('SELECT id FROM workers WHERE username=? AND id<>?').get(username,input.id??'');if(duplicate)fail('Ese usuario ya existe.');
   const id=input.id??randomUUID();
   if(old)this.db.prepare('UPDATE workers SET name=?,username=?,role=?,active=? WHERE id=?').run(name,username,input.role,Number(input.active),id);
   else this.db.prepare('INSERT INTO workers(id,name,username,role,active) VALUES(?,?,?,?,?)').run(id,name,username,input.role,Number(input.active));
   if(!input.active||old?.username!==username)this.db.prepare('DELETE FROM sessions WHERE worker_id=?').run(id);
   return this.worker(id)!;
  });
 }
 resetPin(id:string){return this.transaction(()=>{const worker=this.worker(id);if(!worker)fail('Trabajador no encontrado.',404);if(!worker.active)fail('Activa al trabajador antes de crear su acceso.');const pin=String(randomInt(1000,10000));this.db.prepare('UPDATE workers SET pin_hash=? WHERE id=?').run(pinHash(pin),id);this.db.prepare('DELETE FROM sessions WHERE worker_id=?').run(id);this.db.prepare('DELETE FROM attempts WHERE username=?').run(worker.username);return {username:worker.username,pin};});}
 login(username:string,pin:string,now=Date.now()){
  username=String(username??'').trim().toLowerCase();pin=String(pin??'');
  if(username.length>40||pin.length>32)fail('Usuario o PIN incorrectos.',401);
  const attempt=this.db.prepare('SELECT count,until_ms FROM attempts WHERE username=?').get(username) as {count:number;until_ms:number}|undefined;
  if(attempt&&attempt.until_ms>now&&attempt.count>=5)fail('Demasiados intentos. Espera 15 minutos o pide un nuevo PIN.',429);
  const record=this.db.prepare('SELECT id,pin_hash,active FROM workers WHERE username=?').get(username) as {id:string;pin_hash:string|null;active:number}|undefined;
  const hash=record?.pin_hash??pinHash('not-a-valid-pin','00000000000000000000000000000000');const [salt,key]=hash.split(':');
  const valid=timingSafeEqual(scryptSync(pin,salt,64),Buffer.from(key,'hex'));
  if(!valid||!record?.active||!record.pin_hash){const count=attempt&&attempt.until_ms>now?attempt.count+1:1;this.db.prepare('INSERT OR REPLACE INTO attempts VALUES(?,?,?)').run(username,count,attempt&&attempt.until_ms>now?attempt.until_ms:now+15*60000);fail('Usuario o PIN incorrectos.',401);}
  this.db.prepare('DELETE FROM attempts WHERE username=? OR until_ms<?').run(username,now);this.db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
  const token=randomBytes(32).toString('base64url');this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),record.id,now+12*3600000);return token;
 }
 session(token:string,now=Date.now()){const row=this.db.prepare('SELECT worker_id FROM sessions WHERE token_hash=? AND expires>?').get(digest(token),now) as {worker_id:string}|undefined;const worker=row?this.worker(row.worker_id):undefined;return worker?.active?worker:null;}
 logout(token:string){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));}
 clock(id:string,action:'in'|'out',requestId:string,now=new Date().toISOString()){
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))fail('Identificador de registro inválido.');
  return this.transaction(()=>{const worker=this.worker(id);if(!worker?.active)fail('Acceso no disponible.',401);
   if(action==='in'){
    const duplicate=this.db.prepare('SELECT * FROM shifts WHERE request_id=? AND worker_id=?').get(requestId,id) as Shift|undefined;if(duplicate)return duplicate;
    const open=this.current(id);if(open)return open;
    const previous=this.db.prepare('SELECT ended_at FROM shifts WHERE worker_id=? AND ended_at>?').get(id,now);if(previous)fail('Hay un registro posterior a esta hora.');
    this.db.prepare('INSERT INTO shifts VALUES(?,?,?,?,?,?,?)').run(randomUUID(),id,worker.role,RATES[worker.role],now,null,requestId);
    return this.current(id)!;
   }
   const shift=this.db.prepare('SELECT * FROM shifts WHERE id=? AND worker_id=?').get(requestId,id) as Shift|undefined;if(!shift)fail('Turno no encontrado. Actualiza la página.',409);if(shift.ended_at)return shift;
   if(now<=shift.started_at)fail('Espera un momento antes de registrar la salida.');
   this.db.prepare('UPDATE shifts SET ended_at=? WHERE id=?').run(now,shift.id);return {...shift,ended_at:now};
  });
 }
 history(id:string){return this.db.prepare('SELECT * FROM shifts WHERE worker_id=? ORDER BY started_at DESC LIMIT 50').all(id) as Shift[];}
 report(from:string,to:string,now=new Date().toISOString()){try{validateRange(from,to);}catch(e){fail((e as Error).message);}const periods=payPeriods(now);const estimate=(a:string,b:string)=>{const records=this.db.prepare('SELECT * FROM shifts WHERE started_at<? AND (ended_at IS NULL OR ended_at>?)').all(new Date(dayStart(b)+86400000).toISOString(),new Date(dayStart(a)).toISOString()) as Shift[];const completed=payroll(records,a,b);const live=payroll(records.map(s=>s.ended_at?s:{...s,ended_at:now}),a,b);return {from:a,to:b,days:live,completedCents:completed.reduce((n,d)=>n+d.cents,0),liveCents:live.reduce((n,d)=>n+d.cents,0),openCount:records.filter(s=>!s.ended_at).length};};const start=new Date(dayStart(from)).toISOString(),end=new Date(dayStart(to)+86400000).toISOString();const shifts=this.db.prepare('SELECT * FROM shifts WHERE started_at<? AND (ended_at IS NULL OR ended_at>?) ORDER BY started_at DESC').all(end,start) as Shift[];
  return {week:estimate(periods.weekFrom,periods.weekTo),month:estimate(periods.monthFrom,periods.monthTo),workers:this.workers(),shifts,active:this.db.prepare('SELECT * FROM shifts WHERE ended_at IS NULL').all() as Shift[],days:payroll(shifts,from,to),audit:this.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all() as Audit[],now:new Date().toISOString()};
 }
 correct(id:string,start:string,end:string,reason:string,actor:string,now=Date.now()){
  const a=Date.parse(start),b=Date.parse(end);reason=String(reason??'').trim();
  if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b||b>now||a<Date.parse('2026-01-01')||reason.length<5||reason.length>500)fail('Revisa las horas (sin fechas futuras) y escribe un motivo de al menos 5 caracteres.');
  start=new Date(a).toISOString();end=new Date(b).toISOString();
  return this.transaction(()=>{const shift=this.db.prepare('SELECT * FROM shifts WHERE id=?').get(id) as Shift|undefined;if(!shift)fail('Turno no encontrado.',404);
   if(this.db.prepare('SELECT id FROM shifts WHERE worker_id=? AND id<>? AND started_at<? AND (ended_at IS NULL OR ended_at>?)').get(shift.worker_id,id,end,start))fail('Las horas se superponen con otro turno de este trabajador.');
   const updated={...shift,started_at:start,ended_at:end};this.db.prepare('UPDATE shifts SET started_at=?,ended_at=? WHERE id=?').run(start,end,id);this.db.prepare('INSERT INTO audit(shift_id,actor,reason,before_json,after_json,created_at) VALUES(?,?,?,?,?,?)').run(id,actor,reason,JSON.stringify(shift),JSON.stringify(updated),new Date(now).toISOString());return updated;
  });
 }
}
