import {reportedFee, type ReportedFee} from './fees.ts';
export type ArchivedPayment=ReportedFee&{id:string;day:string};
export type ArchivedReport={summary:{id:string;date:string;gross:number;fee:number;tax:number;retention:number;net:number;count:number};payments:ArchivedPayment[]};
export function depositSummary(s:any):ArchivedReport['summary']{
 const number=(v:any)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error('Resumen incompleto.');return v;};
 if(typeof s.settlement_report_id!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.disbursement_date))throw Error('Depósito incompleto.');
 return {id:s.settlement_report_id,date:s.disbursement_date,gross:number(s.gross_amount),fee:number(s.total_fee),tax:number(s.total_tax),retention:number(s.total_retention),net:number(s.disbursed_net_amount),count:number(s.total_transactions)};
}
export function archivePayments(details:any,depositDate:string):ArchivedPayment[]{
 if(!Array.isArray(details))throw Error('Desglose incompleto.');
 return details.flatMap(day=>{if(!Array.isArray(day.payments))throw Error('Desglose incompleto.');return day.payments.map((p:any)=>{const date=p.payment_date??day.date;if(typeof p.receipt_no!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Recibo incompleto.');return {id:p.receipt_no,day:date,...reportedFee(p,depositDate)};});});
}
export function archivedFees(reports:ArchivedReport[],from:string,to:string){
 const data:Record<string,ReportedFee>={};
 for(const report of reports)for(const {id,day,...fee} of report.payments){if(day<from||day>to)continue;if(data[id]&&JSON.stringify(data[id])!==JSON.stringify(fee))throw Error('Recibo en múltiples liquidaciones.');data[id]=fee;}
 return data;
}
