import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPersonnelPool,runPersonnel} from '../lib/personnel/postgres.ts';
import {PersonnelError} from '../lib/personnel/errors.ts';

test('Supabase personnel: durable auth, concurrent clocks, payroll cutoff, audit and private schema', {skip:!process.env.PERSONNEL_TEST_DATABASE_URL},async()=>{
 const pool=createPersonnelPool(process.env.PERSONNEL_TEST_DATABASE_URL!);
 const otherPool=createPersonnelPool(process.env.PERSONNEL_TEST_DATABASE_URL!);
 const run=<T>(fn:Parameters<typeof runPersonnel<T>>[1])=>runPersonnel(pool,fn);
 let id='';
 try{
  const worker=await run(s=>s.saveWorker({name:'Integration test',username:'test.'+randomUUID().slice(0,8),role:'detallador',active:true}));id=worker.id;
  const credentials=await run(s=>s.resetPin(id));assert.match(credentials.pin,/^\d{4}$/);
  const token=await run(s=>s.login(worker.username,credentials.pin,'integration-network'));assert.equal(typeof token,'string');
  assert.equal((await runPersonnel(otherPool,s=>s.session(token as string)))?.id,id);
  const starts=await Promise.all([run(s=>s.clock(id,'in',randomUUID(),'2026-11-02T15:00:00.000Z')),runPersonnel(otherPool,s=>s.clock(id,'in',randomUUID(),'2026-11-02T15:00:00.000Z'))]);assert.equal(starts[0].id,starts[1].id);
  const live=await run(s=>s.report('2026-11-01','2026-11-07','2026-11-03T01:30:00.000Z'));assert.equal(live.week.days.find(d=>d.worker_id===id)?.cents,90000);assert.equal(live.month.days.find(d=>d.worker_id===id)?.cents,90000);
  const closed=await run(s=>s.clock(id,'out',starts[0].id,'2026-11-03T01:30:00.000Z'));assert.equal(closed.ended_at,'2026-11-03T01:30:00.000Z');
  const retry=await runPersonnel(otherPool,s=>s.clock(id,'out',starts[0].id,'2026-11-03T02:00:00.000Z'));assert.equal(retry.ended_at,closed.ended_at);
  await run(s=>s.correct(starts[0].id,'2026-11-02T16:00:00.000Z','2026-11-03T01:30:00.000Z','Integration correction','integration-test',Date.parse('2026-11-04T00:00:00Z')));
  const report=await run(s=>s.report('2026-11-01','2026-11-07','2026-11-04T00:00:00.000Z'));assert.equal(report.days.find(d=>d.worker_id===id)?.cents,81000);assert.equal(report.audit.filter(a=>a.shift_id===closed.id).length,1);
  for(let i=0;i<5;i++){const result=await run(s=>s.login(worker.username,'bad','integration-network'));assert.ok(result instanceof PersonnelError);assert.equal(result.status,401);}
  const locked=await runPersonnel(otherPool,s=>s.login(worker.username,credentials.pin,'integration-network'));assert.ok(locked instanceof PersonnelError);assert.equal(locked.status,429);
  const reset=await run(s=>s.resetPin(id));assert.equal(await run(s=>s.session(token as string)),null);
  const newToken=await run(s=>s.login(worker.username,reset.pin,'integration-network'));assert.equal(typeof newToken,'string');
  await run(s=>s.saveWorker({...worker,active:false}));assert.equal(await run(s=>s.session(newToken as string)),null);
  const access=(await pool.query("SELECT has_schema_privilege('anon','personnel','USAGE') AS anon,has_schema_privilege('authenticated','personnel','USAGE') AS authenticated,(SELECT bool_and(relrowsecurity) FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname='personnel' AND relkind='r') AS rls")).rows[0];assert.deepEqual(access,{anon:false,authenticated:false,rls:true});
 }finally{
  if(id)await run(async s=>{const w=await s.worker(id);assert.ok(w?.username.startsWith('test.'));await s.client.query('DELETE FROM personnel.audit WHERE shift_id IN (SELECT id FROM personnel.shifts WHERE worker_id=$1)',[id]);await s.client.query('DELETE FROM personnel.sessions WHERE worker_id=$1',[id]);await s.client.query('DELETE FROM personnel.shifts WHERE worker_id=$1',[id]);await s.client.query('DELETE FROM personnel.attempts WHERE username=$1',['user:'+w.username]);await s.client.query('DELETE FROM personnel.workers WHERE id=$1',[id]);});
  await pool.end();await otherPool.end();
 }
});
