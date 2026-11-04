import {ChevronDown} from 'lucide-react';
import styles from './card-settlement.module.css';
type FeeState={archived?:boolean;lastSyncedAt?:string;syncError?:string;historyLimited?:boolean;availableFrom?:string;ok?:boolean;error?:string;failedReports?:number};
type Props={available:boolean;pending:number;confirmed:number;count:number;net:number;deductions:number;loading:boolean;depositDates:string[];fees?:FeeState};
const money=(n:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
const date=(day:string)=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',timeZone:'America/Mexico_City'}).format(new Date(day+'T12:00:00-06:00'));
export function CardSettlement({available,pending,confirmed,count,net,deductions,loading,depositDates,fees}:Props){
 const depositLabel=depositDates.length===1?date(depositDates[0]):depositDates.length?`${date(depositDates[0])} – ${date(depositDates.at(-1)!)}`:null;
 return <section className={styles.settlement} aria-label="Depósito neto a cuenta Nu"><div className={styles.heading}><span>Depósito neto a cuenta Nu</span><strong>{available&&(!pending||confirmed>0)?money(net):'—'}</strong></div>
 {!available?<p className={styles.status}>Consultando ventas…</p>:<>
 {pending>0?<p className={styles.status} role="status">{confirmed>0?<><b>Subtotal confirmado · No es el total del periodo</b><br/></>:null}{loading?'Consultando liquidaciones…':`${confirmed} de ${count} pagos con desglose · ${pending} sin confirmar`}</p>:count===0?<p className={styles.meta}>Sin ventas con tarjeta en este periodo.</p>:null}
 {count>0&&<div className={styles.meta}><span>Cargos Clip e IVA{pending?' confirmados':''}: {money(deductions)}</span>{depositLabel&&<span>Depósito: {depositLabel}</span>}</div>}
 </>}
 {fees?.syncError&&<p className={styles.status}>{fees.syncError}</p>}{fees?.ok===false&&<p className={styles.status}>{fees.error||'No se pudo consultar el desglose de Clip.'}</p>}{!!fees?.failedReports&&<p className={styles.status}>Algunos desgloses no están disponibles. Vuelve a actualizar.</p>}
 {fees?.historyLimited&&pending>0&&<p className={styles.status}>El periodo incluye importes antiguos sin confirmar.</p>}
 <details className={styles.details}><summary>Ver desglose<ChevronDown size={15} aria-hidden="true"/></summary><div><p>Reportado por Clip · Solo tarjeta. No incluye efectivo ni egresos. Incluye propinas liquidadas, si existen.</p>{fees?.archived&&<p>Desgloses guardados automáticamente.{fees.lastSyncedAt?` Última sincronización: ${new Date(fees.lastSyncedAt).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})}.`:''}</p>}{pending>0&&<p>Los pagos sin confirmar requieren un reporte de Clip o un depósito pendiente.</p>}{fees?.historyLimited&&fees.availableFrom&&<p>Clip permite consultar depósitos desde {date(fees.availableFrom)}. Los importes anteriores sin respaldo no están incluidos en el subtotal.</p>}</div></details>
 </section>;
}
