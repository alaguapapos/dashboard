import {dailySales,type DailyPayment} from './daily-sales.ts';
export type RegisterExpense={id:string;date:string;cents:number;method:string;cash_source?:string;has_receipt?:number|boolean};
export const OPENING_CENTS=100000;
export function registerDays(payments:DailyPayment[],expenses:RegisterExpense[],from:string,to:string){
 const days=dailySales(payments,from,to).map(d=>({...d,expenseCents:0,expenseCount:0,receiptCount:0,unclassifiedCount:0,openingCents:OPENING_CENTS,expectedCents:OPENING_CENTS+d.cashCents}));
 const byDay=new Map(days.map(d=>[d.day,d]));
 for(const e of expenses){const d=byDay.get(e.date);if(!d)continue;
  if(e.method==='Efectivo'&&e.cash_source==='register'){d.expenseCents+=e.cents;d.expenseCount++;if(e.has_receipt)d.receiptCount++;d.expectedCents-=e.cents;}
  else if(e.method==='Efectivo'&&(!e.cash_source||e.cash_source==='unknown'))d.unclassifiedCount++;
 }
 return days;
}
