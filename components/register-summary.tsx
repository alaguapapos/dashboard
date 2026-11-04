'use client';
import {useMemo,useState} from 'react';
import {Wallet,Plus,Download} from 'lucide-react';
import {BusinessDayStatus} from '@/components/business-day-status';
import {Button} from '@/components/ui/button';
import {registerDays,type RegisterExpense,OPENING_CENTS} from '@/lib/data/register';
import type {DailyPayment} from '@/lib/data/daily-sales';
const format=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});
const money=(cents:number)=>format.format(cents/100);
export function RegisterSummary({payments,expenses,from,to,available,loading,onAdd}:{payments:DailyPayment[];expenses:RegisterExpense[];from:string;to:string;available:boolean;loading:boolean;onAdd:()=>void}){
 const days=useMemo(()=>registerDays(payments,expenses,from,to),[payments,expenses,from,to]);
 const [page,setPage]=useState(0);
 const totals=days.reduce((t,d)=>({cash:t.cash+d.cashCents,expenses:t.expenses+d.expenseCents,count:t.count+d.expenseCount,unknown:t.unknown+d.unclassifiedCount}),{cash:0,expenses:0,count:0,unknown:0});
 function download(){const lines=[['Fecha','Fondo inicial MXN','Ventas efectivo MXN','Gastos de caja MXN','Gastos','Efectivo esperado MXN','Egresos sin clasificar'],...days.map(d=>[d.day,d.openingCents/100,d.cashCents/100,d.expenseCents/100,d.expenseCount,d.expectedCents/100,d.unclassifiedCount])];const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`caja-${from}-${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="panel register-summary" aria-labelledby="register-title" aria-busy={loading}>
  <div className="panel-head"><div><h2 id="register-title"><Wallet size={19}/> Control de caja</h2><p>Fondo inicial diario: {money(OPENING_CENTS)} · Cierre 7:30 p.m. · Ciudad de México</p></div><div className="register-actions"><Button variant="outline" disabled={!available||loading} onClick={download}><Download size={16}/>Exportar caja</Button><Button className="primary-button" onClick={onAdd}><Plus size={16}/>Gasto de caja</Button></div></div>
  {!available?<div className="empty" role="status">{loading?'Consultando caja…':'No se puede calcular la caja sin ventas y egresos completos.'}</div>:<>
   <div className="register-totals"><div><span>Ventas en efectivo</span><strong>{money(totals.cash)}</strong></div><div><span>Gastos de caja</span><strong>{money(totals.expenses)}</strong><small>{totals.count} gastos registrados</small></div><div><span>Efectivo generado en el periodo</span><strong>{money(totals.cash-totals.expenses)}</strong><small>Ventas en efectivo menos gastos de caja</small></div></div>
   {totals.unknown>0&&<div className="warning">{totals.unknown} egresos en efectivo sin origen confirmado. Edita esos egresos para indicar si salieron de caja; todavía no se descuentan aquí.</div>}
   <div className="table-scroll"><table className="register-table"><thead><tr><th>Día</th><th>Ventas efectivo</th><th>Gastos de caja</th><th>Número de gastos</th><th>Efectivo esperado</th></tr></thead><tbody>{days.slice(page*7,page*7+7).map(d=><tr key={d.day}><th scope="row">{new Intl.DateTimeFormat('es-MX',{weekday:'short',day:'numeric',month:'short',timeZone:'America/Mexico_City'}).format(new Date(d.day+'T12:00:00-06:00'))}<BusinessDayStatus day={d.day}/></th><td data-label="Ventas efectivo">{money(d.cashCents)}</td><td data-label="Gastos de caja">{money(d.expenseCents)}</td><td data-label="Número de gastos">{d.expenseCount}</td><td data-label="Efectivo esperado" className="register-expected">{money(d.expectedCents)}{d.unclassifiedCount>0&&<small>Por revisar</small>}</td></tr>)}</tbody></table></div>
   <div className="table-footer"><span>{page*7+1}–{Math.min(page*7+7,days.length)} de {days.length} días</span><div><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button variant="outline" disabled={(page+1)*7>=days.length} onClick={()=>setPage(p=>p+1)}>Siguiente</Button></div></div>
  </>}
  <p className="daily-note">Cada día: $1,000 de fondo + ventas en efectivo − gastos de caja. Supone que la caja vuelve a iniciar con $1,000 cada día. El total del periodo no suma los fondos diarios. Compara el efectivo esperado con el dinero físico; otros retiros o depósitos no están incluidos.</p>
 </section>;
}
