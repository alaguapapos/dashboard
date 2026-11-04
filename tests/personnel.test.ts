import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {PersonnelStore} from '../lib/personnel/store.ts';
import {payroll,payPeriods} from '../lib/personnel/payroll.ts';
import {type Shift} from '../lib/personnel/types.ts';
const shift=(role:'lavador'|'detallador',start:string,end:string|null,id='one'):Shift=>({id,worker_id:'worker',role,rate_cents:role==='lavador'?36000:9000,started_at:start,ended_at:end,request_id:id});
test('Lavador gets one full day for multiple shifts; hourly seconds aggregate before rounding',()=>{
 const days=payroll([shift('lavador','2026-11-02T15:00:00Z','2026-11-02T15:15:00Z'),shift('lavador','2026-11-02T16:00:00Z','2026-11-02T18:00:00Z','two')],'2026-11-02','2026-11-02');assert.equal(days[0].cents,36000);assert.equal(days[0].seconds,8100);
 assert.equal(payroll([shift('detallador','2026-11-02T15:00:00Z','2026-11-02T16:30:00Z')],'2026-11-02','2026-11-02')[0].cents,13500);
 assert.equal(payroll([shift('detallador','2026-11-02T15:00:00Z','2026-11-02T15:00:01Z'),shift('detallador','2026-11-02T16:00:00Z','2026-11-02T16:00:01Z','two')],'2026-11-02','2026-11-02')[0].cents,5);
});
test('Pay ends at 19:00 Mexico City, preserving real checkout and excluding overnight accrual',()=>{
 const late=shift('detallador','2026-11-02T09:00:00-06:00','2026-11-02T19:30:00-06:00');
 const result=payroll([late],'2026-11-02','2026-11-03');assert.equal(result.length,1);assert.equal(result[0].seconds,36000);assert.equal(result[0].cents,90000);assert.equal(late.ended_at,'2026-11-02T19:30:00-06:00');
 const exact={...late,ended_at:'2026-11-02T19:00:00-06:00'};assert.deepEqual(payroll([exact],'2026-11-02','2026-11-03'),result);
 const overnight={...late,ended_at:'2026-11-04T09:00:00-06:00'};assert.deepEqual(payroll([overnight],'2026-11-02','2026-11-04'),result);assert.deepEqual(payroll([overnight],'2026-11-03','2026-11-04'),[]);
 assert.equal(payroll([{...late,ended_at:'2026-11-02T18:30:00-06:00'}],'2026-11-02','2026-11-02')[0].cents,85500);
 for(const role of ['lavador','detallador'] as const){assert.deepEqual(payroll([shift(role,'2026-11-02T19:00:00-06:00','2026-11-02T19:30:00-06:00')],'2026-11-02','2026-11-02'),[]);}
 assert.equal(payroll([{...late,role:'lavador',rate_cents:36000}],'2026-11-02','2026-11-02')[0].cents,36000);
 assert.deepEqual(payroll([{...late,ended_at:null}],'2026-11-02','2026-11-02'),[]);
 assert.throws(()=>payroll([late],'2026-02-30','2026-03-01'));
});
test('Live weekly and monthly estimates stop at cutoff; corrected and completed shifts use the same cap',()=>{
 const s=new PersonnelStore(':memory:');try{
  const worker=s.workers().find(w=>w.username==='diego')!;
  const opened=s.clock(worker.id,'in','cutoff-test-123456','2026-11-02T15:00:00.000Z');
  const before=s.report('2026-11-01','2026-11-07','2026-11-03T00:30:00.000Z');assert.equal(before.week.liveCents,85500);
  const late=s.report('2026-11-01','2026-11-07','2026-11-03T01:30:00.000Z');assert.equal(late.week.liveCents,90000);assert.equal(late.month.liveCents,90000);assert.equal(late.week.completedCents,0);
  s.clock(worker.id,'out',opened.id,'2026-11-03T01:30:00.000Z');
  s.correct(opened.id,opened.started_at,'2026-11-03T02:30:00.000Z','Salida corregida','owner',Date.parse('2026-11-04T00:00:00Z'));
  const final=s.report('2026-11-01','2026-11-07','2026-11-04T00:00:00.000Z');assert.equal(final.week.liveCents,90000);assert.equal(final.week.completedCents,90000);assert.equal(final.days[0].seconds,36000);assert.equal(final.shifts[0].ended_at,'2026-11-03T02:30:00.000Z');
 }finally{s.close();}
});
test('Weekly pay cycle ends Saturday across months and years',()=>{
 assert.deepEqual(payPeriods('2026-11-03T18:00:00Z'),{weekFrom:'2026-11-01',weekTo:'2026-11-07',monthFrom:'2026-11-01',monthTo:'2026-11-30'});
 assert.equal(payPeriods('2026-11-08T05:59:00Z').weekTo,'2026-11-07');
 assert.equal(payPeriods('2026-11-08T06:00:00Z').weekTo,'2026-11-14');
 assert.equal(payPeriods('2027-01-01T18:00:00Z').weekFrom,'2026-12-27');
});
test('Worker management, PIN hashing, throttling, sessions, and access revocation',()=>{
 const s=new PersonnelStore(':memory:');try{
  assert.equal(s.workers().length,5);const julio=s.workers().find(w=>w.username==='julio')!;assert.equal(julio.role,'lavador');
  const cred=s.resetPin(julio.id);assert.match(cred.pin,/^\d{4}$/);const hash=s.db.prepare('SELECT pin_hash FROM workers WHERE id=?').get(julio.id)!.pin_hash;assert.notEqual(hash,cred.pin);assert.equal('pin_hash' in s.workers()[0],false);
  const token=s.login('JULIO',cred.pin);assert.equal(s.session(token)?.id,julio.id);assert.equal(s.session(token,Date.now()+13*3600000),null);
  for(let i=0;i<5;i++)assert.throws(()=>s.login('julio','xxxx'));
  assert.throws(()=>s.login('julio',cred.pin),/Demasiados/);const next=s.resetPin(julio.id);assert.equal(s.session(token),null);
  const current=s.login('julio',next.pin);s.saveWorker({...julio,active:false});assert.equal(s.session(current),null);assert.throws(()=>s.login('julio',next.pin));assert.throws(()=>s.resetPin(julio.id));
  assert.throws(()=>s.saveWorker({name:'Another',username:'emilio',role:'lavador',active:true}),/ya existe/);
 }finally{s.close();}
});
test('Clock operations are idempotent, worker-scoped, and preserve historical rates',()=>{
 const s=new PersonnelStore(':memory:');try{
  const julio=s.workers().find(w=>w.username==='julio')!,diego=s.workers().find(w=>w.username==='diego')!;
  const a=s.clock(julio.id,'in','request-one-123456','2026-11-02T15:00:00Z');
  assert.equal(s.clock(julio.id,'in','request-two-123456','2026-11-02T15:01:00Z').id,a.id);
  assert.throws(()=>s.saveWorker({...julio,role:'detallador',active:true}),/salida/);
  assert.throws(()=>s.clock(diego.id,'out',a.id,'2026-11-02T18:00:00Z'),/no encontrado/);
  s.clock(julio.id,'out',a.id,'2026-11-02T18:00:00Z');assert.equal(s.clock(julio.id,'out',a.id,'2026-11-02T19:00:00Z').ended_at,'2026-11-02T18:00:00Z');
  assert.equal(s.clock(julio.id,'in','request-one-123456','2026-11-02T19:00:00Z').ended_at,'2026-11-02T18:00:00Z');assert.equal(s.current(julio.id),null);
  s.saveWorker({...julio,role:'detallador',active:true});assert.equal(s.report('2026-11-02','2026-11-02').days[0].cents,36000);
 }finally{s.close();}
});
test('Corrections recalculate pay, retain audit, reject overlap and future dates',()=>{
 const s=new PersonnelStore(':memory:');try{
  const w=s.workers().find(w=>w.username==='diego')!;const a=s.clock(w.id,'in','request-one-123456','2026-11-02T15:00:00Z');
  s.correct(a.id,a.started_at,'2026-11-02T17:00:00Z','Olvidó la salida','owner@example.test',Date.parse('2026-11-03T20:00:00Z'));
  const report=s.report('2026-11-02','2026-11-02');assert.equal(report.days[0].cents,18000);assert.equal(report.audit.length,1);assert.equal(JSON.parse(report.audit[0].before_json).ended_at,null);
  s.clock(w.id,'in','request-two-123456','2026-11-02T18:00:00Z');assert.throws(()=>s.correct(a.id,a.started_at,'2026-11-02T19:00:00Z','Superposición','owner',Date.parse('2026-11-03T20:00:00Z')),/superponen/);
  assert.throws(()=>s.correct(a.id,a.started_at,'2027-01-01T00:00:00Z','Future date','owner',Date.parse('2026-11-03T20:00:00Z')),/futuras/);
 }finally{s.close();}
});
test('Live weekly/monthly cost counts an open Lavador day only once and survives reopening',()=>{
 const folder=mkdtempSync(join(tmpdir(),'alagua-personnel-')),path=join(folder,'test.sqlite');let s=new PersonnelStore(path);
 try{
  const w=s.workers().find(w=>w.username==='julio')!;const now=new Date('2026-11-03T18:00:00Z'),start=new Date(now.getTime()-60000).toISOString();const first=s.clock(w.id,'in','request-one-123456',start);s.clock(w.id,'out',first.id,new Date(now.getTime()-30000).toISOString());s.clock(w.id,'in','request-two-123456',new Date(now.getTime()-10000).toISOString());
  const {weekFrom,weekTo}=payPeriods(now);let report=s.report(weekFrom,weekTo,now.toISOString());assert.equal(report.week.liveCents,36000);assert.equal(report.week.completedCents,36000);assert.equal(report.month.liveCents,36000);assert.equal(report.week.openCount,1);
  s.close();s=new PersonnelStore(path);report=s.report(weekFrom,weekTo,now.toISOString());assert.equal(report.active.length,1);assert.equal(s.workers().length,5);
 }finally{s.close();rmSync(folder,{recursive:true,force:true});}
});

test('inventory administrators authenticate without clock access or payroll rows',()=>{
 const s=new PersonnelStore(':memory:');try{
  const before=s.report('2026-11-01','2026-11-07');
  const receiver=s.saveWorker({name:'Inventory test',username:'inventory.test',role:'administrador',active:true});
  s.setPin(receiver.id,'0381');
  const token=s.login(receiver.username,'0381');assert.equal(s.session(token)?.role,'administrador');
  assert.equal(s.workers().filter(w=>w.role!=='administrador').length,5);
  assert.throws(()=>s.clock(receiver.id,'in','inventory-admin-guard'),'inventory-only access must not create a shift');
  assert.throws(()=>s.clock(receiver.id,'out','inventory-admin-guard'));
  assert.equal(s.current(receiver.id),null);assert.deepEqual(s.history(receiver.id),[]);
  assert.throws(()=>s.saveWorker({...receiver,role:'lavador',active:true}),/acceso separado/);
  const worker=s.workers().find(w=>w.role==='lavador')!;assert.throws(()=>s.saveWorker({...worker,role:'administrador',active:true}),/acceso separado/);
  const after=s.report('2026-11-01','2026-11-07');assert.equal(after.workers.length,before.workers.length);assert.equal(after.inventoryAdmins.length,1);assert.equal(after.inventoryAdmins[0].id,receiver.id);assert.deepEqual(after.days,before.days);assert.equal(after.week.liveCents,before.week.liveCents);assert.equal(after.month.liveCents,before.month.liveCents);
  // Even an inconsistent historical row must never turn inventory access into payroll.
  s.db.prepare('INSERT INTO shifts VALUES(?,?,?,?,?,?,?)').run('legacy-admin-row',receiver.id,'lavador',36000,'2026-11-02T15:00:00Z',null,'legacy-admin-request');
  const guarded=s.report('2026-11-01','2026-11-07','2026-11-02T17:00:00Z');assert.deepEqual(guarded.active,[]);assert.deepEqual(guarded.shifts,[]);assert.equal(guarded.week.openCount,0);assert.equal(guarded.month.openCount,0);assert.equal(guarded.week.liveCents,0);
  s.db.prepare('UPDATE shifts SET ended_at=? WHERE id=?').run('2026-11-02T17:00:00Z','legacy-admin-row');assert.deepEqual(s.report('2026-11-01','2026-11-07').days,[]);
  assert.deepEqual(payroll([{...shift('detallador','2026-11-02T15:00:00Z','2026-11-02T17:00:00Z'),role:'administrador',rate_cents:9000}],'2026-11-02','2026-11-02'),[]);
  assert.throws(()=>s.setPin(receiver.id,'123'));assert.throws(()=>s.setPin(receiver.id,'12345'));
  s.setPin(receiver.id,'4718');assert.equal(s.session(token),null);assert.throws(()=>s.login(receiver.username,'0381'));
  const next=s.login(receiver.username,'4718');s.saveWorker({...receiver,active:false});assert.equal(s.session(next),null);
 }finally{s.close();}
});


test('legacy SQLite role migration preserves paid history and foreign-key references',()=>{
 const directory=mkdtempSync(join(tmpdir(),'alagua-access-'));const file=join(directory,'personnel.sqlite');
 const legacy=new DatabaseSync(file);
 legacy.exec("CREATE TABLE workers(id TEXT PRIMARY KEY,name TEXT NOT NULL,username TEXT NOT NULL UNIQUE,role TEXT NOT NULL CHECK(role IN ('lavador','detallador')),active INTEGER NOT NULL DEFAULT 1,pin_hash TEXT); CREATE TABLE shifts(id TEXT PRIMARY KEY,worker_id TEXT NOT NULL REFERENCES workers(id),role TEXT NOT NULL,rate_cents INTEGER NOT NULL,started_at TEXT NOT NULL,ended_at TEXT,request_id TEXT NOT NULL UNIQUE); CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,worker_id TEXT NOT NULL REFERENCES workers(id),expires INTEGER NOT NULL); CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); INSERT INTO settings VALUES('seeded','1'); INSERT INTO workers VALUES('legacy','Legacy worker','legacy','lavador',1,'unchanged-hash'); INSERT INTO shifts VALUES('old-shift','legacy','lavador',36000,'2026-11-02T15:00:00Z','2026-11-02T17:00:00Z','original-request'); INSERT INTO sessions VALUES('old-session','legacy',1999999999999);");
 legacy.close();
 const store=new PersonnelStore(file);
 try{
  assert.equal(store.worker('legacy')?.username,'legacy');assert.equal(store.db.prepare('SELECT pin_hash FROM workers WHERE id=?').get('legacy')!.pin_hash,'unchanged-hash');assert.equal(store.history('legacy').length,1);assert.equal(store.db.prepare('SELECT count(*) AS count FROM sessions').get()!.count,1);
  store.saveWorker({name:'Receiver',username:'receiver',role:'administrador',active:true});
  assert.equal(store.report('2026-11-02','2026-11-02').days[0].cents,36000);assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{store.close();rmSync(directory,{recursive:true,force:true});}
});
