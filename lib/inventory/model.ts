import {PersonnelError} from '../personnel/errors.ts';
export const SERVICES={mini:{label:'Mini',cents:13000},standard:{label:'Standard',cents:19000},media_gamuza:{label:'1/2 Gamuza',cents:19500},gamuza:{label:'Gamuza',cents:20000},botas:{label:'Botas',cents:21000},otros:{label:'Otros',cents:0}} as const;
export type Service=keyof typeof SERVICES;
export type Pair={id:string;service:Service;description:string;observations:string;baseCents:number;express:boolean;laces:boolean;status:'received'|'ready'|'delivered';readyAt?:string;deliveredAt?:string};
export type Payment={id:string;cents:number;method:'cash'|'card'|'transfer';at:string;actor:string;voided?:{at:string;actor:string;reason:string}};
export type Notification={at:string;actor:string;method:'whatsapp'|'phone'|'in_person';recipient:string};
export type Order={id:string;folio:string;customer:string;whatsapp:string;receivedOn:string;pairs:Pair[];payments:Payment[];createdAt:string;updatedAt:string;version:number;notification?:Notification|null};
export type Event={id:number;order_id:string;actor:string;action:string;at:string;details:string};
export const pairTotal=(p:Pair)=>p.baseCents+(p.express?7000:0)+(p.laces?15000:0);
export function amounts(o:Order){const total=o.pairs.reduce((n,p)=>n+pairTotal(p),0),paid=o.payments.reduce((n,p)=>n+(p.voided?0:p.cents),0);return {total,paid,balance:total-paid};}
export function completion(o:Order){const total=o.pairs.length,done=o.pairs.filter(p=>p.status==='ready'||p.status==='delivered').length;return {total,done,percent:total?Math.floor(done/total*100):0,complete:total>0&&done===total};}
export function orderStatus(o:Order){if(o.pairs.length&&o.pairs.every(p=>p.status==='delivered'))return 'delivered';if(completion(o).complete)return 'ready';if(o.pairs.some(p=>p.status==='delivered'))return 'partial_delivered';return 'received';}
export function workQueue(o:Order){const status=orderStatus(o);return status==='ready'?(o.notification?'notified':'notify'):status==='delivered'?'delivered':'processing';}
export function isExpress(o:Order){return o.pairs.some(p=>p.express&&p.status==='received');}
export function overduePickup(o:Order,now=new Date()){
 // Clamp to the target month's last day, using UTC so every device agrees.
 // For example, April 30 minus two months must not roll forward into March.
 const cutoff=new Date(now),day=cutoff.getUTCDate();cutoff.setUTCDate(1);cutoff.setUTCMonth(cutoff.getUTCMonth()-2);
 const lastDay=new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+1,0)).getUTCDate();cutoff.setUTCDate(Math.min(day,lastDay));
 return o.pairs.some(p=>p.status==='ready'&&p.readyAt&&Date.parse(p.readyAt)<cutoff.getTime());
}
export function priority(o:Order,now=new Date()){return overduePickup(o,now)?0:isExpress(o)?1:workQueue(o)==='notify'?2:workQueue(o)==='processing'?3:workQueue(o)==='notified'?4:5;}
export function text(value:unknown,label:string,max:number,required=true){if(typeof value!=='string')throw new PersonnelError(`Revisa ${label}.`);const s=value.trim();if((required&&!s)||s.length>max)throw new PersonnelError(`Revisa ${label}.`);return s;}
export function cents(value:unknown,allowZero=false){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(allowZero?0:1)||value>100000000)throw new PersonnelError('Importe inválido.');return value;}
export function mexicoDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City'}).format(now);}
export function validateOrder(raw:Record<string,unknown>,id:string,now=new Date()):Order{
 const folio=text(raw.folio,'el folio',40).toUpperCase();if(!/^[A-Z0-9 -]+$/.test(folio))throw new PersonnelError('El folio solo permite letras, números, espacios y guiones.');
 const receivedOn=text(raw.receivedOn,'la fecha de recepción',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)||!Number.isFinite(Date.parse(receivedOn))||new Date(receivedOn).toISOString().slice(0,10)!==receivedOn||receivedOn>mexicoDay(now))throw new PersonnelError('Revisa la fecha de recepción.');
 const whatsapp=text(raw.whatsapp,'WhatsApp',24).replace(/[\s()-]/g,'');if(!/^\+?\d{10,15}$/.test(whatsapp))throw new PersonnelError('Ingresa un WhatsApp válido, con lada.');
 if(!Array.isArray(raw.pairs)||raw.pairs.length<1||raw.pairs.length>50)throw new PersonnelError('Registra entre 1 y 50 pares por pedido.');
 const pairs=raw.pairs.map((p:Record<string,unknown>,i:number):Pair=>{
  if(!p||typeof p!=='object'||!Object.hasOwn(SERVICES,String(p.service)))throw new PersonnelError('Selecciona un servicio válido.');
  const service=p.service as Service;
  if(typeof p.express!=='boolean'||typeof p.laces!=='boolean')throw new PersonnelError('Revisa los adicionales del par.');
  return {id:`${id}-${i+1}`,service,description:text(p.description,'marca y color',160),observations:text(p.observations??'','el estado de recepción',1000,false),baseCents:service==='otros'?cents(p.baseCents):SERVICES[service].cents,express:p.express,laces:p.laces,status:'received'};
 });
 return {id,folio,customer:text(raw.customer,'el nombre del cliente',120),whatsapp,receivedOn,pairs,payments:[],createdAt:now.toISOString(),updatedAt:now.toISOString(),version:1};
}
export function payment(o:Order,raw:Record<string,unknown>,actor:string,now:string):Payment{
 const amount=cents(raw.cents);if(amount>amounts(o).balance)throw new PersonnelError('El pago supera el saldo restante. Actualiza el pedido.');
 if(!['cash','card','transfer'].includes(String(raw.method)))throw new PersonnelError('Selecciona el método de pago.');
 return {id:requestId(raw.requestId),cents:amount,method:raw.method as Payment['method'],at:now,actor};
}
export function requestId(value:unknown){if(typeof value!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(value))throw new PersonnelError('Identificador de operación inválido.');return value;}
export function inventoryTotals(orders:Order[]){return orders.reduce((n,o)=>{for(const p of o.pairs){if(p.status!=='delivered')n.inShop++;if(p.status==='received')n.processing++;if(p.status==='ready')n.ready++;}n.balance+=amounts(o).balance;return n;},{inShop:0,processing:0,ready:0,balance:0});}
