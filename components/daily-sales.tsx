'use client';
import {useMemo,useState} from 'react';
import {Download,ArrowRight,CalendarDays} from 'lucide-react';
import {BusinessDayStatus} from '@/components/business-day-status';
import {Button} from '@/components/ui/button';
import {dailySales,type DailyPayment} from '@/lib/data/daily-sales';
const currency=new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});
const date=new Intl.DateTimeFormat('es-MX',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'America/Mexico_City'});
const money=(cents:number)=>currency.format(cents/100);
export function DailySalesSummary({payments,from,to,today,available,loading,feesLoading,feeError,filterLabel,onDay}:{payments:DailyPayment[];from:string;to:string;today:string;available:boolean;loading:boolean;feesLoading:boolean;feeError?:string;filterLabel:string;onDay:(day:string)=>void}){
 const days=useMemo(()=>dailySales(payments,from,to),[payments,from,to]);
 const [page,setPage]=useState(0);
 const visible=days.slice(page*7,page*7+7);
 const count=days.reduce((n,d)=>n+d.count,0),total=days.reduce((n,d)=>n+d.totalCents,0);
 const deductions=days.reduce((n,d)=>n+d.deductionCents,0),commission=days.reduce((n,d)=>n+d.feeCents,0),tax=days.reduce((n,d)=>n+d.taxCents,0),pending=days.reduce((n,d)=>n+d.pendingFees,0);
 function download(){
  const lines=[['Fecha','Ventas','Total MXN','Ventas efectivo','Efectivo MXN','Ventas tarjeta','Tarjeta MXN','Ventas otros','Otros MXN','Comision reportada MXN','IVA reportado MXN','Deducciones reportadas MXN','Pagos sin desglose','Neto despues de Clip MXN'],...days.map(d=>[d.day,d.count,(d.totalCents/100).toFixed(2),d.cashCount,(d.cashCents/100).toFixed(2),d.cardCount,(d.cardCents/100).toFixed(2),d.otherCount,(d.otherCents/100).toFixed(2),(d.feeCents/100).toFixed(2),(d.taxCents/100).toFixed(2),(d.deductionCents/100).toFixed(2),d.pendingFees,d.pendingFees?'':((d.totalCents-d.deductionCents)/100).toFixed(2)])];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=`ventas-diarias-${from}-${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="panel daily-summary" aria-labelledby="daily-title" aria-busy={loading}>
  <div className="panel-head"><div><h2 id="daily-title"><CalendarDays size={19}/> Ventas por día</h2><p>{filterLabel} · Ventas aprobadas, sin propinas · Ciudad de México</p></div><Button variant="outline" onClick={download} disabled={!available||loading}><Download size={16}/>Exportar días</Button></div>
  {!available?<div className="empty" role="status">{loading?'Consultando ventas diarias…':'Ventas diarias no disponibles. Actualiza para volver a consultar.'}</div>:<>
   <div className="daily-period"><span>Total del periodo{loading?' · Actualizando…':''}</span><strong>{count} ventas <span>· {money(total)}</span></strong></div>
   <div className="fee-summary"><div><span>Comisión Clip confirmada</span><strong>{money(commission)}</strong></div><div><span>IVA confirmado</span><strong>{money(tax)}</strong></div><div><span>Neto después de Clip</span><strong>{pending?'—':money(total-deductions)}</strong><small>{pending?(feesLoading?'Consultando comisiones…':pending+' pagos sin desglose aún'):'Antes de egresos · Sin propinas'}</small></div></div>
   {feeError&&<p className="daily-note" role="status">{feeError} Los pagos sin desglose no se consideran libres de comisión.</p>}
   <div className="table-scroll"><table className="daily-table"><thead><tr><th scope="col">Día</th><th scope="col">Ventas</th><th scope="col">Efectivo</th><th scope="col">Tarjeta</th><th scope="col">Otros</th><th scope="col">Total vendido</th><th scope="col"><span className="sr-only">Detalle</span></th></tr></thead><tbody>{visible.map(d=><tr key={d.day}>
    <th scope="row" className="daily-date">{date.format(new Date(d.day+'T12:00:00-06:00'))}{d.day===today&&<small>Hoy</small>}<BusinessDayStatus day={d.day}/></th>
    <td className="daily-count"><strong>{d.count}</strong><span> ventas</span></td>
    <td data-label="Efectivo">{money(d.cashCents)}<small>{d.cashCount} ventas</small></td>
    <td data-label="Tarjeta">{money(d.cardCents)}<small>{d.cardCount} ventas</small></td>
    <td data-label="Otros">{money(d.otherCents)}<small>{d.otherCount} ventas</small></td>
    <td className="daily-total" data-label="Total vendido">{money(d.totalCents)}<small>Clip: {d.pendingFees?'Pendiente':money(d.deductionCents)}</small><small>Comisión {money(d.feeCents)} + IVA {money(d.taxCents)}{d.pendingFees?' confirmados':''}</small><strong className="daily-net">Neto: {d.pendingFees?'—':money(d.totalCents-d.deductionCents)}</strong></td>
    <td className="daily-detail"><button className="text-button" onClick={()=>onDay(d.day)} aria-label={`Ver ventas del ${d.day}`}>Ver ventas <ArrowRight size={16}/></button></td>
   </tr>)}</tbody></table></div>
   <div className="table-footer"><span>{page*7+1}–{Math.min(page*7+7,days.length)} de {days.length} días</span><div><Button variant="outline" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button variant="outline" disabled={(page+1)*7>=days.length} onClick={()=>setPage(p=>p+1)}>Siguiente</Button></div></div>
  </>}
  <p className="daily-note">El neto descuenta las deducciones reales de Clip por recibo, no una tasa estimada. El efectivo no lleva comisión. Los pagos sin desglose quedan pendientes; la fecha del depósito puede ser posterior a la venta. Una venta es un pago aprobado en Clip. No incluye pagos cancelados o rechazados. La jornada termina a las 7:30 p.m. de Ciudad de México. Los movimientos conservan su fecha de calendario; los reportes siguen incorporando sincronizaciones y cargos de Clip.</p>
 </section>;
}
