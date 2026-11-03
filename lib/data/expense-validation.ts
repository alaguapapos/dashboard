export function validateExpense(e:any){
 if(!/^[a-zA-Z0-9-]{10,64}$/.test(e.id)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date||!Number.isSafeInteger(e.cents)||e.cents<=0||e.cents>1000000000||typeof e.description!=='string'||!e.description.trim()||e.description.length>500||typeof e.category!=='string'||!e.category.trim()||e.category.length>60||!['Efectivo','Tarjeta','Transferencia'].includes(e.method))return 'Revisa fecha, concepto y monto (mayor a cero).';
 if(!['register','other','unknown'].includes(e.cash_source))return 'Selecciona el origen del dinero.';
 if(e.cash_source==='register'&&(e.method!=='Efectivo'||typeof e.spent_by!=='string'||!e.spent_by.trim()))return 'Los gastos de caja requieren efectivo y nombre del trabajador.';
 if(e.spent_by!=null&&(typeof e.spent_by!=='string'||e.spent_by.length>100))return 'El nombre debe tener máximo 100 caracteres.';
 return null;
}
export function receiptType(bytes:Uint8Array){
 const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
 if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'image/webp';
 if(ascii(0,5)==='%PDF-')return 'application/pdf';
 return null;
}
