import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPersonnelPool,runPersonnel} from '../lib/personnel/postgres.ts';
import {InventoryStore,eligibleForCleanup} from '../lib/inventory/store.ts';
import {amounts,inventoryTotals,orderStatus,workQueue,type Order} from '../lib/inventory/model.ts';
test('inventory: durable mixed order, payment retries, stale changes, partial pickup, private storage',{skip:!process.env.PERSONNEL_TEST_DATABASE_URL},async()=>{
 const pool=createPersonnelPool(process.env.PERSONNEL_TEST_DATABASE_URL!);const id=randomUUID();
 const run=<T>(fn:(s:InventoryStore)=>Promise<T>)=>runPersonnel(pool,s=>fn(new InventoryStore(s)));
 const raw={action:'create',requestId:id,folio:('TEST-'+id.slice(0,24)).toUpperCase(),customer:'Cliente de prueba',whatsapp:'5512345678',receivedOn:'2026-11-03',pairs:[{service:'botas',description:'Negras',observations:'Desgaste',express:true,laces:true},{service:'mini',description:'Blancas',observations:'',express:false,laces:false}],initialPayment:{cents:10000,method:'cash'}};
 try{
  const order=await run(s=>s.mutate(raw,'Prueba'));assert.equal(amounts(order).total,56000);assert.equal(amounts(order).paid,10000);
  assert.equal((await run(s=>s.mutate(raw,'Prueba'))).id,id);
  await assert.rejects(()=>run(s=>s.mutate({...raw,requestId:randomUUID()},'Prueba')),/folio ya existe/);
  const pay={action:'payment',requestId:randomUUID(),id,version:1,cents:46000,method:'card'};
  const [a,b]=await Promise.all([run(s=>s.mutate(pay,'Prueba')),run(s=>s.mutate(pay,'Prueba'))]);assert.equal(a.payments.length,2);assert.equal(b.payments.length,2);assert.equal(amounts(a).balance,0);
  await assert.rejects(()=>run(s=>s.mutate({...pay,requestId:randomUUID()},'Prueba')),/actualizó/);
  const ready=await run(s=>s.mutate({action:'status',requestId:randomUUID(),id,version:a.version,pairId:a.pairs[0].id,status:'ready'},'Prueba'));
  const delivered=await run(s=>s.mutate({action:'status',requestId:randomUUID(),id,version:ready.version,pairId:a.pairs[0].id,status:'delivered'},'Prueba'));
  assert.deepEqual(inventoryTotals([delivered]),{inShop:1,processing:1,ready:0,balance:0});
  await assert.rejects(()=>run(s=>s.mutate({action:'status',requestId:randomUUID(),id,version:delivered.version,pairId:a.pairs[1].id,status:'delivered'},'Prueba')),/no válido/);
  assert.equal((await run(s=>s.events(id))).length,4);
  const access=await pool.query("SELECT has_table_privilege('anon','personnel.inventory_orders','SELECT') AS allowed");assert.equal(access.rows[0].allowed,false);
 }finally{await pool.query('DELETE FROM personnel.inventory_orders WHERE id=$1 AND folio=$2',[id,raw.folio]);await pool.end();}
});

test('inventory notices require completion and confirmation; corrections keep audit and authorization',{skip:!process.env.PERSONNEL_TEST_DATABASE_URL},async()=>{
 const pool=createPersonnelPool(process.env.PERSONNEL_TEST_DATABASE_URL!);const id=randomUUID(),folio=('TEST-NOTICE-'+id.slice(0,20)).toUpperCase();
 const run=<T>(fn:(s:InventoryStore)=>Promise<T>)=>runPersonnel(pool,s=>fn(new InventoryStore(s)));
 let o:Order;
 try{
  o=await run(s=>s.mutate({action:'create',requestId:id,folio,customer:'Prueba de avisos',whatsapp:'5512345678',receivedOn:'2026-11-03',pairs:[{service:'mini',description:'Prueba A',observations:'',express:false,laces:false},{service:'standard',description:'Prueba B',observations:'',express:false,laces:false}],initialPayment:{cents:10000,method:'cash'}},'Prueba'));
  const act=(payload:Record<string,unknown>,admin=false)=>run(s=>s.mutate({requestId:randomUUID(),id,version:o.version,...payload},'Prueba',admin));
  await assert.rejects(()=>act({action:'notify',method:'whatsapp',confirmed:true}),/Termina todos/);
  o=await act({action:'status',pairId:o.pairs[0].id,status:'ready'});
  await assert.rejects(()=>act({action:'notify',method:'whatsapp',confirmed:true}),/Termina todos/);
  o=await act({action:'status',pairId:o.pairs[1].id,status:'ready'});
  await assert.rejects(()=>act({action:'notify',method:'whatsapp'}),/Confirma/);
  const notice={action:'notify',method:'whatsapp',confirmed:true,requestId:randomUUID(),id,version:o.version};
  o=await run(s=>s.mutate(notice,'Prueba'));assert.equal(o.notification?.actor,'Prueba');assert.equal(o.notification?.recipient,'5512345678');assert.ok(Date.parse(o.notification!.at));
  await run(s=>s.mutate(notice,'Prueba'));assert.equal((await run(s=>s.events(id))).filter(e=>e.action==='notify').length,1);
  await assert.rejects(()=>act({action:'notify',method:'phone',confirmed:true}),/ya fue/);
  await assert.rejects(()=>act({action:'reopen_pair',pairId:o.pairs[0].id,reason:'x'}),/motivo/);
  o=await act({action:'reopen_pair',pairId:o.pairs[0].id,reason:'Falta terminar limpieza'});assert.equal(o.notification,null);assert.equal(o.pairs[0].readyAt,undefined);assert.match((await run(s=>s.events(id)))[0].details,/Aviso anterior invalidado/);
  o=await act({action:'status',pairId:o.pairs[0].id,status:'ready'});o=await act({action:'notify',method:'phone',confirmed:true});
  o=await act({action:'contact',customer:o.customer,whatsapp:'5512345679'});assert.equal(o.notification,null);
  o=await act({action:'notify',method:'in_person',confirmed:true});o=await act({action:'reset_notification',reason:'Aviso registrado por error'});assert.equal(o.notification,null);
  await assert.rejects(()=>act({action:'void_payment',paymentId:o.payments[0].id,reason:'Importe incorrecto'}),e=>!!e&&typeof e==='object'&&'status' in e&&e.status===403);
  o=await act({action:'void_payment',paymentId:o.payments[0].id,reason:'Importe incorrecto'},true);assert.equal(o.payments.length,1);assert.equal(o.payments[0].voided?.reason,'Importe incorrecto');assert.equal(amounts(o).balance,32000);
  await assert.rejects(()=>act({action:'void_payment',paymentId:o.payments[0].id,reason:'Importe incorrecto'},true),/no disponible/);
  const restored=await run(s=>s.get(id));assert.deepEqual(restored,o);
 }finally{await pool.query('DELETE FROM personnel.inventory_orders WHERE id=$1 AND folio=$2',[id,folio]);await pool.end();}
});

test('owner can undo an accidental delivery with audit, preserved payments and notices, and safe retries',{skip:!process.env.PERSONNEL_TEST_DATABASE_URL},async()=>{
 const pool=createPersonnelPool(process.env.PERSONNEL_TEST_DATABASE_URL!);const id=randomUUID(),folio=('TEST-UNDO-'+id.slice(0,20)).toUpperCase();
 const run=<T>(fn:(s:InventoryStore)=>Promise<T>)=>runPersonnel(pool,s=>fn(new InventoryStore(s)));
 let o:Order;
 try{
  o=await run(s=>s.mutate({action:'create',requestId:id,folio,customer:'Prueba de entrega',whatsapp:'5512345678',receivedOn:'2026-11-03',pairs:[{service:'mini',description:'Prueba A',observations:'',express:false,laces:false},{service:'standard',description:'Prueba B',observations:'',express:false,laces:false}],initialPayment:{cents:32000,method:'cash'}},'Prueba'));
  const act=(payload:Record<string,unknown>,admin=false)=>run(s=>s.mutate({requestId:randomUUID(),id,version:o.version,...payload},'Prueba',admin));
  await assert.rejects(()=>act({action:'undo_delivery',pairId:o.pairs[0].id,reason:'Marcado por error'},true),/marcado como entregado/);
  o=await act({action:'status',pairId:o.pairs[0].id,status:'ready'});
  o=await act({action:'status',pairId:o.pairs[1].id,status:'ready'});
  o=await act({action:'notify',method:'whatsapp',confirmed:true});
  o=await act({action:'status',pairId:o.pairs[0].id,status:'delivered'});
  o=await act({action:'status',pairId:o.pairs[1].id,status:'delivered'});
  const before=structuredClone(o),eventsBefore=(await run(s=>s.events(id))).length;
  const future=new Date(Date.now()+366*24*3600000);
  assert.equal(eligibleForCleanup(o,future),true);
  const correction={action:'undo_delivery',pairId:o.pairs[0].id,reason:'Se marcó entregado el par equivocado',requestId:randomUUID(),id,version:o.version};
  await assert.rejects(()=>run(s=>s.mutate(correction,'Prueba')),e=>!!e&&typeof e==='object'&&'status' in e&&e.status===403);
  await assert.rejects(()=>act({...correction,reason:'  sí  '},true),/motivo/);
  await assert.rejects(()=>act({...correction,pairId:'missing-pair'},true),/marcado como entregado/);
  await assert.rejects(()=>act({...correction,version:o.version-1},true),/actualizó/);
  assert.deepEqual(await run(s=>s.get(id)),before);
  assert.equal((await run(s=>s.events(id))).length,eventsBefore);

  o=await run(s=>s.mutate(correction,'Administrador de prueba',true));
  assert.equal(o.pairs[0].status,'ready');assert.equal(o.pairs[0].deliveredAt,undefined);
  assert.equal(o.pairs[0].readyAt,before.pairs[0].readyAt);assert.deepEqual(o.pairs[1],before.pairs[1]);
  assert.deepEqual(o.payments,before.payments);assert.deepEqual(o.notification,before.notification);
  assert.equal(o.version,before.version+1);assert.equal(orderStatus(o),'ready');assert.equal(workQueue(o),'notified');
  assert.deepEqual(inventoryTotals([o]),{inShop:1,processing:0,ready:1,balance:0});assert.equal(eligibleForCleanup(o,future),false);
  const events=await run(s=>s.events(id)),audit=events[0];
  assert.equal(events.length,eventsBefore+1);assert.equal(audit.action,'undo_delivery');assert.equal(audit.actor,'Administrador de prueba');
  assert.ok(audit.details.includes(before.pairs[0].deliveredAt!));assert.ok(audit.details.includes(correction.reason));assert.ok(audit.details.includes('Par 1')||audit.details.includes('par 1'));
  assert.deepEqual(await run(s=>s.mutate(correction,'Administrador de prueba',true)),o);
  assert.equal((await run(s=>s.events(id))).length,events.length);
  await assert.rejects(()=>run(s=>s.mutate(correction,'Administrador de prueba')),e=>!!e&&typeof e==='object'&&'status' in e&&e.status===403);
  await assert.rejects(()=>act({action:'undo_delivery',pairId:o.pairs[0].id,reason:correction.reason},true),/marcado como entregado/);
  await assert.rejects(()=>run(s=>s.mutate({...correction,reason:'Otro motivo'},'Administrador de prueba',true)),/ya se utilizó/);
  assert.deepEqual(await run(s=>s.get(id)),o);
 }finally{await pool.query('DELETE FROM personnel.inventory_orders WHERE id=$1 AND folio=$2',[id,folio]);await pool.end();}
});
