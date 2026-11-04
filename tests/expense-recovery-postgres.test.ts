import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPersonnelPool,runPersonnel} from '../lib/personnel/postgres.ts';
import {changeExpenseState} from '../lib/data/expense-recovery.ts';
test('expense deletion and restoration preserve data, record actor, reject stale changes and stay atomic',{skip:!process.env.PERSONNEL_TEST_DATABASE_URL},async()=>{
 const pool=createPersonnelPool(process.env.PERSONNEL_TEST_DATABASE_URL!);const id=randomUUID(),at=new Date().toISOString();
 const run=(action:'delete'|'restore',version:string)=>runPersonnel(pool,s=>changeExpenseState(s,{id,expected_updated_at:version},'recovery-test',action));
 try{
  await pool.query("INSERT INTO public.expenses(id,date,category,description,cents,method,cash_source,spent_by,receipt_key,created_at,updated_at) VALUES($1,'2026-11-03','Otros','Prueba de recuperación',12345,'Efectivo','register','Prueba','test-preserved-object',$2,$2)",[id,at]);
  await assert.rejects(()=>run('delete','stale'),/cambió/);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM personnel.expense_events WHERE expense_id=$1',[id])).rows[0].n,0);
  const concurrent=await Promise.allSettled([run('delete',at),run('delete',at)]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  const deleted=(await pool.query('SELECT * FROM public.expenses WHERE id=$1',[id])).rows[0];assert.ok(deleted.deleted_at);assert.equal(deleted.deleted_by,'recovery-test');assert.equal(deleted.cents,12345);assert.equal(deleted.receipt_key,'test-preserved-object');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.expenses WHERE id=$1 AND deleted_at IS NULL',[id])).rows[0].n,0);
  await assert.rejects(()=>run('restore',at),/cambió/);
  const restored=await run('restore',deleted.updated_at);const row=(await pool.query('SELECT * FROM public.expenses WHERE id=$1',[id])).rows[0];assert.equal(row.deleted_at,null);assert.equal(row.deleted_by,null);assert.equal(row.cents,12345);assert.equal(row.date,'2026-11-03');assert.equal(row.cash_source,'register');assert.equal(row.receipt_key,'test-preserved-object');
  await assert.rejects(()=>run('restore',restored.updated_at),/ya está activo/);
  const events=(await pool.query('SELECT * FROM personnel.expense_events WHERE expense_id=$1 ORDER BY id',[id])).rows;assert.deepEqual(events.map(e=>e.action),['delete','restore']);assert.ok(events.every(e=>e.actor==='recovery-test'));assert.equal(events[0].before_document.deleted_at,null);assert.equal(events[1].after_document.deleted_at,null);
  assert.equal((await pool.query("SELECT has_table_privilege('anon','personnel.expense_events','SELECT') AS allowed")).rows[0].allowed,false);
 }finally{await pool.query('DELETE FROM personnel.expense_events WHERE expense_id=$1',[id]);await pool.query("DELETE FROM public.expenses WHERE id=$1 AND description='Prueba de recuperación'",[id]);await pool.end();}
});
