export type DailyPayment = {id:string;day:string;status:string;currency:string;method:string;amount:number;deductionCents?:number;feeCents?:number;taxCents?:number};
export type DailySales = {day:string;count:number;totalCents:number;cashCount:number;cashCents:number;cardCount:number;cardCents:number;otherCount:number;otherCents:number;feeCents:number;taxCents:number;deductionCents:number;pendingFees:number};
/** Calendar days are supplied by Clip normalization in America/Mexico_City. */
export function dailySales(payments:DailyPayment[],from:string,to:string):DailySales[]{
 const days=new Map<string,DailySales>();
 for(let t=Date.parse(from+'T12:00:00Z');t<=Date.parse(to+'T12:00:00Z')&&days.size<367;t+=86400000){
  const day=new Date(t).toISOString().slice(0,10);
  days.set(day,{day,count:0,totalCents:0,cashCount:0,cashCents:0,cardCount:0,cardCents:0,otherCount:0,otherCents:0,feeCents:0,taxCents:0,deductionCents:0,pendingFees:0});
 }
 const seen=new Set<string>();
 for(const payment of payments){
  const day=days.get(payment.day);
  if(!day||payment.status!=='Paid'||payment.currency!=='MXN'||!Number.isFinite(payment.amount)||seen.has(payment.id))continue;
  seen.add(payment.id);
  const cents=Math.round(payment.amount*100);
  day.count++;day.totalCents+=cents;
  if(payment.method!=='CASH'){
   if(Number.isSafeInteger(payment.deductionCents)){day.deductionCents+=payment.deductionCents!;day.feeCents+=payment.feeCents??0;day.taxCents+=payment.taxCents??0;}
   else day.pendingFees++;
  }
  if(payment.method==='CASH'){day.cashCount++;day.cashCents+=cents;}
  else if(payment.method==='CREDIT'||payment.method==='DEBIT'){day.cardCount++;day.cardCents+=cents;}
  else{day.otherCount++;day.otherCents+=cents;}
 }
 return [...days.values()].reverse();
}
