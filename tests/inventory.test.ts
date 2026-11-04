import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOrder,amounts,inventoryTotals,payment,orderStatus,completion,workQueue,priority,overduePickup} from '../lib/inventory/model.ts';
import {eligibleForCleanup} from '../lib/inventory/store.ts';
const now=new Date('2026-11-03T18:00:00Z');
const draft={folio:'00123',customer:'Ana',whatsapp:'5512345678',receivedOn:'2026-11-03',pairs:[{service:'botas',description:'Botas negras',observations:'Desgaste',express:true,laces:true},{service:'gamuza',description:'Adidas azul',observations:'',express:false,laces:false},{service:'mini',description:'Nike blanco',observations:'',express:false,laces:false}]};
function order(){return validateOrder(draft,'request-123456789012',now);}
test('mixed services and per-pair additions calculate exact cent totals',()=>{const o=order();assert.equal(amounts(o).total,76000);assert.equal(inventoryTotals([o]).inShop,3);assert.equal(o.folio,'00123');});
test('advance and full payment cannot exceed balance',()=>{const o=order();o.payments.push(payment(o,{cents:20000,method:'cash',requestId:'payment-123456789'},'Julio',now.toISOString()));assert.equal(amounts(o).balance,56000);assert.throws(()=>payment(o,{cents:56001,method:'cash',requestId:'payment-123456789'},'Julio',now.toISOString()));assert.throws(()=>payment(o,{cents:1.5,method:'cash',requestId:'payment-123456789'},'Julio',now.toISOString()));});
test('partial pickup keeps remaining shoes in inventory',()=>{const o=order();o.pairs[0].status='delivered';o.pairs[1].status='ready';assert.deepEqual(inventoryTotals([o]),{inShop:2,processing:1,ready:1,balance:76000});assert.equal(orderStatus(o),'partial_delivered');o.pairs[2].status='ready';assert.equal(orderStatus(o),'ready');});
test('server rejects future dates, invalid services and missing condition descriptions',()=>{assert.throws(()=>validateOrder({...draft,receivedOn:'2026-11-04'},'test',now));assert.throws(()=>validateOrder({...draft,receivedOn:'2026-02-30'},'test',now));assert.throws(()=>validateOrder({...draft,pairs:[{...draft.pairs[0],service:'express'}]},'test',now));assert.throws(()=>validateOrder({...draft,pairs:[{...draft.pairs[0],description:''}]},'test',now));});
test('cleanup retains old paid uncollected orders and unpaid delivered orders',()=>{const o=order();o.payments=[{id:'paid',cents:76000,method:'cash',at:now.toISOString(),actor:'test'}];assert.equal(eligibleForCleanup(o,new Date('2027-06-01')),false);for(const p of o.pairs){p.status='delivered';p.deliveredAt='2026-11-03T18:00:00Z';}assert.equal(eligibleForCleanup(o,new Date('2027-02-03T17:59:00Z')),false);assert.equal(eligibleForCleanup(o,new Date('2027-02-04')),true);o.payments=[];assert.equal(eligibleForCleanup(o,new Date('2027-06-01')),false);});

test('order completion requires every pair, independent of payment or partial pickup',()=>{
 const o=order();assert.equal(completion(o).percent,0);assert.equal(orderStatus(o),'received');
 o.pairs[0].status='ready';assert.equal(completion(o).percent,33);assert.equal(orderStatus(o),'received');
 o.pairs[0].status='delivered';o.pairs[1].status='ready';assert.equal(completion(o).percent,66);assert.equal(completion(o).complete,false);assert.notEqual(orderStatus(o),'ready');
 o.pairs[2].status='ready';assert.equal(completion(o).percent,100);assert.equal(orderStatus(o),'ready');assert.ok(amounts(o).balance>0);
 o.pairs.forEach(p=>p.status='delivered');assert.equal(orderStatus(o),'delivered');assert.equal(completion(o).percent,100);
 const empty={...o,pairs:[]};assert.equal(completion(empty).complete,false);assert.equal(orderStatus(empty),'received');
});
test('work queues separate completed orders, confirmed notices and urgent work',()=>{
 const o=order();assert.equal(workQueue(o),'processing');assert.equal(priority(o,now),1);
 o.pairs[0].status='ready';assert.equal(workQueue(o),'processing');assert.equal(priority(o,now),3);
 o.pairs.forEach(p=>p.status='ready');assert.equal(workQueue(o),'notify');assert.equal(priority(o,now),2);
 o.notification={at:now.toISOString(),actor:'Julio',method:'whatsapp',recipient:o.whatsapp};assert.equal(workQueue(o),'notified');
 o.pairs[0].status='delivered';assert.equal(workQueue(o),'notified');
 o.pairs[1].readyAt='2026-01-01T12:00:00Z';assert.equal(priority(o,now),0);
 o.pairs.forEach(p=>p.status='delivered');assert.equal(workQueue(o),'delivered');
});
test('voided bookkeeping payments remain recorded but reopen the balance and prevent cleanup',()=>{
 const o=order();const p=payment(o,{cents:76000,method:'cash',requestId:'payment-123456789'},'Julio',now.toISOString());o.payments.push(p);
 o.pairs.forEach(p=>{p.status='delivered';p.deliveredAt=now.toISOString();});assert.equal(eligibleForCleanup(o,new Date('2027-06-01')),true);
 p.voided={at:now.toISOString(),actor:'Admin',reason:'Registro duplicado'};
 assert.equal(o.payments.length,1);assert.equal(amounts(o).paid,0);assert.equal(amounts(o).balance,76000);assert.equal(eligibleForCleanup(o,new Date('2027-06-01')),false);
});
test('pickup aging clamps shorter months and does not mark recent pairs overdue',()=>{
 const o=order();const p=o.pairs[0];p.status='ready';
 p.readyAt='2026-03-01T12:00:00Z';assert.equal(overduePickup(o,new Date('2026-04-30T12:00:00Z')),false);
 p.readyAt='2026-02-28T11:59:59Z';assert.equal(overduePickup(o,new Date('2026-04-30T12:00:00Z')),true);
 p.readyAt='2028-02-29T12:00:00Z';assert.equal(overduePickup(o,new Date('2028-04-30T12:00:00Z')),false);
 p.readyAt='2028-02-29T11:59:59Z';assert.equal(overduePickup(o,new Date('2028-04-30T12:00:00Z')),true);
 p.readyAt='2026-12-31T12:00:00Z';assert.equal(overduePickup(o,new Date('2027-01-31T12:00:00Z')),false);
 p.readyAt='2026-11-30T11:59:59Z';assert.equal(overduePickup(o,new Date('2027-01-31T12:00:00Z')),true);
 p.status='delivered';assert.equal(overduePickup(o,new Date('2027-01-31T12:00:00Z')),false);
});
