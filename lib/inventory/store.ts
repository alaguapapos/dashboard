import {createHash} from 'node:crypto';
import type {PostgresPersonnelStore} from '../personnel/postgres.ts';
import {PersonnelError} from '../personnel/errors.ts';
import {amounts,payment,requestId,text,validateOrder,orderStatus,type Order,type Event} from './model.ts';
export function eligibleForCleanup(o:Order,now=new Date()){
 const cutoff=new Date(now),day=cutoff.getUTCDate();cutoff.setUTCDate(1);cutoff.setUTCMonth(cutoff.getUTCMonth()-3);
 const last=new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+1,0)).getUTCDate();cutoff.setUTCDate(Math.min(day,last));
 return amounts(o).balance===0&&o.pairs.every(p=>p.status==='delivered'&&p.deliveredAt&&Date.parse(p.deliveredAt)<cutoff.getTime());
}
export class InventoryStore{
 private db:PostgresPersonnelStore;
 constructor(db:PostgresPersonnelStore){this.db=db;}
 async list(){return (await this.db.rows<{document:Order}>('SELECT document FROM personnel.inventory_orders ORDER BY received_on DESC,updated_at DESC')).map(r=>r.document);}
 async get(id:string){const row=(await this.db.rows<{document:Order}>('SELECT document FROM personnel.inventory_orders WHERE id=$1',[id]))[0];if(!row)throw new PersonnelError('Pedido no encontrado.',404);return row.document;}
 async events(id:string){return this.db.rows<Event>('SELECT * FROM personnel.inventory_events WHERE order_id=$1 ORDER BY id DESC',[id]);}
 async mutate(raw:Record<string,unknown>,actor:string,isAdmin=false){
  if(raw.action==='void_payment'&&!isAdmin)throw new PersonnelError('Solo el administrador puede anular pagos.',403);
  if(raw.action==='undo_delivery'&&!isAdmin)throw new PersonnelError('Solo el administrador puede corregir una entrega.',403);
  const key=requestId(raw.requestId),fingerprint=createHash('sha256').update(JSON.stringify(raw)).digest('hex');
  const prior=(await this.db.rows<{order_id:string;actor:string;fingerprint:string}>('SELECT * FROM personnel.inventory_requests WHERE request_id=$1',[key]))[0];
  if(prior){if(prior.actor!==actor||prior.fingerprint!==fingerprint)throw new PersonnelError('Esta operación ya se utilizó. Actualiza el pedido.',409);return this.get(prior.order_id);}
  const now=new Date().toISOString();let order:Order;let details='';
  if(raw.action==='create'){
   order=validateOrder(raw,key);
   if((await this.db.rows('SELECT id FROM personnel.inventory_orders WHERE folio=$1',[order.folio])).length)throw new PersonnelError('Este folio ya existe. Busca el pedido antes de registrarlo.',409);
   if(raw.initialPayment){order.payments.push(payment(order,{...(raw.initialPayment as Record<string,unknown>),requestId:key},actor,now));}
   details=`Recepción de ${order.pairs.length} pares. Total: ${amounts(order).total/100} MXN.`;
   await this.db.client.query('INSERT INTO personnel.inventory_orders(id,folio,received_on,document) VALUES($1,$2,$3,$4)',[order.id,order.folio,order.receivedOn,JSON.stringify(order)]);
  }else{
   order=await this.get(text(raw.id,'el pedido',80));
   if(raw.version!==order.version)throw new PersonnelError('Otra persona actualizó este pedido. Vuelve a abrirlo antes de guardar.',409);
   if(raw.action==='payment'){
    const entry=payment(order,raw,actor,now);order.payments.push(entry);details=`Pago de ${entry.cents/100} MXN (${{cash:'efectivo',card:'tarjeta',transfer:'transferencia'}[entry.method]}).`;
   }else if(raw.action==='status'){
    const pair=order.pairs.find(p=>p.id===raw.pairId);if(!pair)throw new PersonnelError('Par no encontrado.');
    if(raw.status==='ready'&&pair.status==='received'){pair.status='ready';pair.readyAt=now;details=`Par ${order.pairs.indexOf(pair)+1} listo para recoger.`;}
    else if(raw.status==='delivered'&&pair.status==='ready'){pair.status='delivered';pair.deliveredAt=now;details=`Entrega del par ${order.pairs.indexOf(pair)+1}. Saldo del pedido: ${amounts(order).balance/100} MXN.`;}
    else throw new PersonnelError('Cambio de estado no válido. Actualiza el pedido.');
   }else if(raw.action==='notify'){
    if(orderStatus(order)!=='ready')throw new PersonnelError('Termina todos los pares antes de avisar al cliente.');
    if(order.notification)throw new PersonnelError('Este cliente ya fue marcado como avisado.',409);
    if(raw.confirmed!==true||!['whatsapp','phone','in_person'].includes(String(raw.method)))throw new PersonnelError('Confirma que ya contactaste al cliente y selecciona el medio.');
    order.notification={at:now,actor,method:raw.method as 'whatsapp'|'phone'|'in_person',recipient:order.whatsapp};
    details=`Cliente avisado por ${{whatsapp:'WhatsApp',phone:'llamada',in_person:'en persona'}[order.notification.method]}. Destino: ${order.whatsapp}. Confirmado por ${actor}.`;
   }else if(raw.action==='reopen_pair'||raw.action==='undo_delivery'||raw.action==='void_payment'||raw.action==='reset_notification'){
    const reason=text(raw.reason,'el motivo de corrección',500);if(reason.length<5)throw new PersonnelError('Escribe un motivo de al menos 5 caracteres.');
    if(raw.action==='reopen_pair'){
     const pair=order.pairs.find(p=>p.id===raw.pairId);if(!pair||pair.status!=='ready')throw new PersonnelError('Solo se puede reabrir un par listo que aún no se ha entregado.');
     const previous=pair.readyAt;pair.status='received';delete pair.readyAt;
     details=`Par ${order.pairs.indexOf(pair)+1} vuelve a proceso (marcado listo: ${previous}). Motivo: ${reason}.`;
     if(order.notification){details+=` Aviso anterior invalidado: ${order.notification.at}, ${order.notification.actor}.`;order.notification=null;}
    }else if(raw.action==='undo_delivery'){
     const pair=order.pairs.find(p=>p.id===raw.pairId);if(!pair||pair.status!=='delivered')throw new PersonnelError('Solo se puede corregir la entrega de un par marcado como entregado.');
     const previous=pair.deliveredAt;pair.status='ready';delete pair.deliveredAt;
     details=`Entrega del par ${order.pairs.indexOf(pair)+1} (${pair.description}) registrada el ${previous??'sin fecha'} corregida: vuelve a estar listo para recoger. Motivo: ${reason}.`;
    }else if(raw.action==='void_payment'){
     const entry=order.payments.find(p=>p.id===raw.paymentId);if(!entry||entry.voided)throw new PersonnelError('Pago no disponible para anular.');
     entry.voided={at:now,actor,reason};details=`Pago registrado de ${entry.cents/100} MXN anulado. Motivo: ${reason}. No se realizó un reembolso.`;
    }else{
     if(!order.notification)throw new PersonnelError('No hay un aviso registrado.');
     details=`Aviso de ${order.notification.at} (${order.notification.actor}) corregido a pendiente. Motivo: ${reason}.`;order.notification=null;
    }
   }else if(raw.action==='contact'){
    const previousPhone=order.whatsapp;
    order.customer=text(raw.customer,'el nombre',120);order.whatsapp=text(raw.whatsapp,'WhatsApp',24).replace(/[\s()-]/g,'');if(!/^\+?\d{10,15}$/.test(order.whatsapp))throw new PersonnelError('Revisa el número de WhatsApp.');
    details='Corrección de datos del cliente.';if(previousPhone!==order.whatsapp&&order.notification){details+=` Aviso previo al número ${previousPhone} invalidado (${order.notification.actor}, ${order.notification.at}).`;order.notification=null;}
   }else throw new PersonnelError('Acción no válida.');
   order.version++;order.updatedAt=now;
   await this.db.client.query('UPDATE personnel.inventory_orders SET document=$1,updated_at=now() WHERE id=$2',[JSON.stringify(order),order.id]);
  }
  await this.db.client.query('INSERT INTO personnel.inventory_events(order_id,actor,action,details) VALUES($1,$2,$3,$4)',[order.id,actor,String(raw.action),details]);
  await this.db.client.query('INSERT INTO personnel.inventory_requests(request_id,order_id,actor,fingerprint) VALUES($1,$2,$3,$4)',[key,order.id,actor,fingerprint]);
  return order;
 }
 async cleanup(now=new Date()){
  // Calendar months, retaining all uncollected or unpaid orders indefinitely.
  const orders=await this.list();const ids=orders.filter(o=>eligibleForCleanup(o,now)).map(o=>o.id);
  if(ids.length)await this.db.client.query('DELETE FROM personnel.inventory_orders WHERE id=ANY($1::text[])',[ids]);
  return {deleted:ids.length};
 }
}
