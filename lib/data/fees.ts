export type ReportedFee={feeCents:number;taxCents:number;deductionCents:number;settledCents:number;depositDate:string};
const cents=(v:unknown)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error('Desglose de comisiones incompleto.');return Math.round(v*100);};
export function reportedFee(payment:any,depositDate:string):ReportedFee{
 const charges=payment.charges;
 if(!charges||typeof charges!=='object'||!charges.charge)throw Error('Desglose de comisiones incompleto.');
 let feeCents=0,taxCents=0;
 for(const charge of Object.values(charges) as any[]){if(charge==null)continue;feeCents+=cents(charge.fee);taxCents+=cents(charge.tax);}
 return {feeCents,taxCents,deductionCents:cents(payment.total_retention),settledCents:cents(payment.settled_amount),depositDate};
}
/** Follow only Clip's own settlement paths; never forward credentials to supplied hosts. */
export function settlementPath(href:string){
 const url=new URL(href,'https://api-gw.payclip.com');
 if(url.origin!=='https://api-gw.payclip.com'||!/^\/settlements\/[a-zA-Z0-9-]+$/.test(url.pathname))throw Error('Enlace de liquidación inesperado.');
 return url.pathname.slice(1)+url.search;
}
