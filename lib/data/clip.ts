async function readClip(url:string,token:string,header='Authorization'):Promise<any>{
 const r=await fetch(url,{headers:{[header]:token,Accept:'application/json','Content-Type':'application/json'},signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error(r.status===401||r.status===403?'Clip rechazó las credenciales o permisos.':`Clip no respondió correctamente (${r.status}).`);
 return r.json();
}
// Settlements retain their documented gateway endpoint and x-api-key header.
export async function clipGet(path:string,token:string,header='Authorization'):Promise<any>{
 return readClip(`https://api-gw.payclip.com/${path}`,token,header);
}
export function normalizePayment(p:any){
 const id=p.receipt_no||p.id;
 if(!id||typeof p.created_at!=='string'||!Number.isFinite(Date.parse(p.created_at))||p.amount==null||!Number.isFinite(Number(p.amount)))throw Error('Transacción incompleta.');
 const method=({credit_card:'CREDIT',debit_card:'DEBIT',cash:'CASH'} as Record<string,string>)[p.payment_method?.type]??'OTHER';
 const status=({approved:'Paid',cancelled:'Cancelled',canceled:'Cancelled',rejected:'Declined'} as Record<string,string>)[p.status]??p.status;
 // Only return fields needed by the dashboard; never forward card tokens or customer data.
 return {id,date:p.created_at,day:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(p.created_at)),status,method,brand:p.payment_method?.id??'',last4:p.payment_method?.card?.last_digits??'',currency:p.currency,amount:Number(p.amount),tip:Number(p.tip_amount??0),total:Number(p.paid_amount??p.amount)};
}
export async function payments(from:string,to:string,token:string){
 const start=new Date(from+'T00:00:00-06:00').getTime(),end=new Date(to+'T23:59:59.999-06:00').getTime();
 const unique=new Map<string,ReturnType<typeof normalizePayment>>();
 for(let a=start;a<=end;a+=29*86400000){
  for(let page=1;page<=100;page++){
   const q=new URLSearchParams({from:new Date(a).toISOString(),to:new Date(Math.min(a+29*86400000,end)).toISOString(),size:'100',page:String(page)});
   const d=await readClip('https://api.payclip.com/payments?'+q,token);
   if(!Array.isArray(d.results)||!Number.isInteger(d.pages?.total)||d.pages.total<0||d.pages.number!==page)throw Error('Paginación de Clip inesperada; consulta incompleta.');
   for(const p of d.results){const payment=normalizePayment(p);unique.set(payment.id,payment);}
   if(page>=d.pages.total)break;
   if(!d.results.length||page===100)throw Error('Consulta de Clip incompleta. Reduce el periodo.');
  }
 }
 return [...unique.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
