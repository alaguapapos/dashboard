import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPersonnelPool,runPersonnel} from '../lib/personnel/postgres.ts';
import {PersonnelError} from '../lib/personnel/errors.ts';

test('Supabase inventory-only account: PIN session, payroll exclusion, and both clock guards', {skip:!process.env.PERSONNEL_TEST_DATABASE_URL},async()=>{
 const pool=createPersonnelPool(process.env.PERSONNEL_TEST_DATABASE_URL!);
 const rollback=Symbol('rollback-test-only-account');
 try{
  await assert.rejects(runPersonnel(pool,async store=>{
   const account=await store.saveWorker({name:'Inventory access test',username:'test.inventory.'+randomUUID().slice(0,8),role:'administrador',active:true});
   await store.setPin(account.id,'0381');
   const token=await store.login(account.username,'0381','inventory-access-test');assert.equal(typeof token,'string');
   assert.equal((await store.session(token as string))?.id,account.id);
   await store.logout(token as string);
   const clock=await store.kioskClock(account.id,'0381','in',randomUUID(),'inventory-access-test');assert.ok(clock instanceof PersonnelError);assert.equal(clock.status,403);
   await assert.rejects(store.clock(account.id,'in',randomUUID()),/solo para inventario/);
   assert.equal(await store.current(account.id),null);
   assert.equal((await store.rows<{count:number}>('SELECT count(*)::int AS count FROM personnel.sessions WHERE worker_id=$1',[account.id]))[0].count,0);
   const report=await store.report('2026-11-01','2026-11-07');assert.ok(!report.workers.some(w=>w.id===account.id));assert.ok(report.inventoryAdmins.some(w=>w.id===account.id));assert.ok(!report.days.some(d=>d.worker_id===account.id));assert.ok(!report.active.some(s=>s.worker_id===account.id));
   await store.client.query('INSERT INTO personnel.shifts(id,worker_id,role,rate_cents,started_at,ended_at,request_id) VALUES($1,$2,$3,$4,$5,NULL,$6)',[randomUUID(),account.id,'lavador',36000,'2026-11-02T15:00:00Z',randomUUID()]);
   const guarded=await store.report('2026-11-01','2026-11-07','2026-11-02T17:00:00Z');assert.ok(!guarded.active.some(s=>s.worker_id===account.id));assert.ok(!guarded.shifts.some(s=>s.worker_id===account.id));assert.ok(!guarded.week.days.some(d=>d.worker_id===account.id));assert.ok(!guarded.month.days.some(d=>d.worker_id===account.id));
   await assert.rejects(store.saveWorker({...account,role:'lavador',active:true}),/acceso separado/);
   throw rollback;
  }),error=>error===rollback);
 }finally{await pool.end();}
});
