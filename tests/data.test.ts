import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {parseWorkbook} from '../lib/data/workbook.ts';
import {payments,normalizePayment} from '../lib/data/clip.ts';
import {dailySales} from '../lib/data/daily-sales.ts';
test('daily totals reconcile cash and cards, omit failures, preserve empty days and local midnight',()=>{
 const make=(id:string,date:string,amount:number,type:string,status='approved')=>normalizePayment({receipt_no:id,created_at:date,amount,currency:'MXN',status,payment_method:{type}});
 const cash=make('cash','2026-10-24T05:59:00Z',190.10,'cash');
 const result=dailySales([cash,cash,make('card','2026-10-23T21:00:00Z',100.20,'credit_card'),make('debit','2026-10-24T06:00:00Z',20,'debit_card'),make('bad','2026-10-23T21:00:00Z',999,'cash','rejected'),make('cancel','2026-10-23T21:00:00Z',999,'cash','cancelled')],'2026-10-22','2026-10-24');
 assert.equal(result[0].day,'2026-10-24');assert.equal(result[0].count,1);
 assert.deepEqual([result[1].count,result[1].cashCount,result[1].cardCount,result[1].totalCents],[2,1,1,29030]);
 assert.equal(result[2].count,0);
 assert.ok(result.every(d=>d.totalCents===d.cashCents+d.cardCents+d.otherCents));
});
test('expense history excludes linked copies, subtotals and retains Sunday payroll',()=>{const wb=XLSX.utils.book_new();const e=XLSX.utils.aoa_to_sheet([['','Julio','Emilio','Diego','Luis','otros','TOTAL'],[46102,1440,1080,1080,180,'',3780],[46136,'','','','',156.75]]);XLSX.utils.book_append_sheet(wb,e,'Egresos');const i=XLSX.utils.aoa_to_sheet([['','FECHA','CARD','CASH','TRANSFER','EGRESO','JULIO','EMI'],['sábado',46102,940,265,'',3780],['domingo',46103,940,265,'','',1000],['lunes',46104,'','','','',2440]]);i.F2.f='Egresos!G2';i.C3.f='SUM(C2:C2)';i.G4.f='SUM(G2:G3)';XLSX.utils.book_append_sheet(wb,i,'Ingresos');const result=parseWorkbook(XLSX.write(wb,{type:'array',bookType:'xlsx'}));assert.equal(result.expenses.reduce((s,e)=>s+e.amount,0),3936.75);assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].amount,1000);assert.equal(result.historical.length,1);assert.ok(result.warnings.length);});
test('Clip follows pagination and deduplicates receipts across windows',async()=>{const original=globalThis.fetch;let count=0;const calls:URL[]=[];globalThis.fetch=async(url:any)=>{count++;calls.push(new URL(url));return new Response(JSON.stringify({results:[{receipt_no:count===2?'same':count===1?'same':'new',created_at:'2026-10-01T06:00:00Z',status:'approved',payment_method:{type:'credit_card'},currency:'MXN',amount:100,paid_amount:100}],pages:{number:Number(new URL(url).searchParams.get('page')),total:count<3?2:1}}));};try{const rows=await payments('2026-10-01','2026-10-31','test');assert.equal(rows.length,2);assert.equal(calls[1].searchParams.get('page'),'2');assert.ok(calls.every(u=>Date.parse(u.searchParams.get('to')!)-Date.parse(u.searchParams.get('from')!)<=30*86400000));}finally{globalThis.fetch=original;}});
test('Clip failure never returns an empty success',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:401});try{await assert.rejects(payments('2026-10-01','2026-10-02','test'),/credenciales/);}finally{globalThis.fetch=original;}});

test('cash normalization preserves Mexico City day and excludes payment secrets',()=>{const p=normalizePayment({receipt_no:'cash-test',created_at:'2026-10-23T21:15:23.123Z',amount:190,tip_amount:0,paid_amount:190,currency:'MXN',status:'approved',payment_method:{type:'cash',id:'cash',token:'private'}});assert.equal(p.method,'CASH');assert.equal(p.status,'Paid');assert.equal(p.day,'2026-10-23');assert.equal(p.amount,190);assert.ok(!JSON.stringify(p).includes('private'));});
test('repeated page numbers fail instead of silently dropping sales',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({results:[{receipt_no:'x',created_at:'2026-10-23T21:15:00Z',amount:190,status:'approved',payment_method:{type:'cash'}}],pages:{number:1,total:2}}));try{await assert.rejects(payments('2026-10-23','2026-10-23','test'),/incompleta/);}finally{globalThis.fetch=original;}});

import {registerDays} from '../lib/data/register.ts';
import {validateExpense,receiptType} from '../lib/data/expense-validation.ts';
test('register uses daily float once and excludes expenses paid outside register',()=>{
 const sales=[{id:'p',day:'2026-10-23',status:'Paid',currency:'MXN',method:'CASH',amount:385}];
 const expenses=[{id:'soap',date:'2026-10-23',method:'Efectivo',cents:15000,cash_source:'register',has_receipt:1},{id:'external',date:'2026-10-23',method:'Efectivo',cents:99900,cash_source:'other'},{id:'legacy',date:'2026-10-23',method:'Efectivo',cents:8000,cash_source:'unknown'}];
 const d=registerDays(sales,expenses,'2026-10-23','2026-10-24');
 assert.equal(d[1].expectedCents,123500);assert.equal(d[1].receiptCount,1);assert.equal(d[1].expenseCount,1);assert.equal(d[1].unclassifiedCount,1);assert.equal(d[0].expectedCents,100000);
});
test('register expense requires a receipt and worker; typed file names cannot spoof receipts',()=>{
 const e={id:'test-expense-01',date:'2026-10-23',cents:15000,description:'Jabón',category:'Insumos',method:'Efectivo',cash_source:'register',spent_by:'Ana'};
 assert.equal(validateExpense(e,true),null);assert.ok(validateExpense(e,false));assert.ok(validateExpense({...e,spent_by:''},true));assert.ok(validateExpense({...e,method:'Tarjeta'},true));assert.equal(validateExpense({...e,cash_source:'other',spent_by:''},false),null);
 assert.equal(receiptType(new TextEncoder().encode('<script>alert(1)</script>')),null);assert.equal(receiptType(new TextEncoder().encode('%PDF-1.7')),'application/pdf');
});

import {reportedFee,settlementPath} from '../lib/data/fees.ts';
test('reported fees reproduce actual payout including IVA without double counting retention',()=>{
 const f=reportedFee({charges:{charge:{fee:80.55,tax:12.90},surcharge:null},total_retention:93.45,settled_amount:2311.55},'2026-10-30');
 assert.deepEqual([f.feeCents,f.taxCents,f.deductionCents,f.settledCents],[8055,1290,9345,231155]);
 const day=dailySales([{id:'paid',day:'2026-10-29',method:'CREDIT',currency:'MXN',status:'Paid',amount:2405,...f},{id:'cash',day:'2026-10-29',method:'CASH',currency:'MXN',status:'Paid',amount:100}],'2026-10-29','2026-10-29')[0];
 assert.equal(day.pendingFees,0);assert.equal(day.totalCents-day.deductionCents,241155);
 const pending=dailySales([{id:'pending',day:'2026-10-30',method:'DEBIT',currency:'MXN',status:'Paid',amount:190}],'2026-10-30','2026-10-30')[0];assert.equal(pending.pendingFees,1);
 assert.throws(()=>reportedFee({charges:{charge:{fee:2}},total_retention:2,settled_amount:98},'2026-10-30'));
});
test('settlement pagination cannot send credentials to another host',()=>{
 assert.equal(settlementPath('/settlements/uuid?page=next'),'settlements/uuid?page=next');
 assert.throws(()=>settlementPath('https://untrusted.example/settlements/uuid'));
 assert.throws(()=>settlementPath('/payments'));
});

import {businessClock,dayStatus} from '../lib/data/business-day.ts';
test('business day ends at 7:30pm Mexico City without shifting calendar dates',()=>{
 assert.equal(businessClock(new Date('2026-10-31T01:29:59Z')).closed,false);
 assert.equal(businessClock(new Date('2026-10-31T01:30:00Z')).closed,true);
 assert.equal(businessClock(new Date('2026-10-31T03:00:00Z')).day,'2026-10-30');
 assert.equal(dayStatus('2026-10-30',new Date('2026-10-31T01:30:00Z')),'Jornada finalizada');
 assert.equal(dayStatus('2026-10-29',new Date('2026-10-30T12:00:00Z')),'Jornada finalizada');
});
