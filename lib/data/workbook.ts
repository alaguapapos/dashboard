import * as XLSX from 'xlsx';
export type Expense={id:string;date:string;category:string;amount:number;source:string;cell:string;review?:string};
const date=(v:unknown)=>{if(typeof v==='number'){return Number.isFinite(v)?new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10):null;}const m=String(v??'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);return m?`${m[3].length===2?'20':''}${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null};
const value=(s:XLSX.WorkSheet,c:number,r:number)=>s[XLSX.utils.encode_cell({c,r})];
const aggregate=(c:any)=>/\b(SUM|SUBTOTAL|SUMA)\s*\([^)]*:/i.test(c?.f??'');
export function parseWorkbook(buffer:ArrayBuffer){
 const wb=XLSX.read(buffer,{type:'array',cellFormula:true});
 const expenses:Expense[]=[];const candidates:Expense[]=[];const warnings:string[]=[];const historical:any[]=[];const tabs=wb.SheetNames;
 const e=wb.Sheets.Egresos;
 if(!e)throw Error('No se encontró la pestaña Egresos.');
 const range=XLSX.utils.decode_range(e['!ref']??'A1:G1');
 for(let r=1;r<=range.e.r;r++){const dt=date(value(e,0,r)?.v);if(!dt)continue;let sum=0;for(let c=1;c<=5;c++){const cell=value(e,c,r);if(typeof cell?.v==='number'&&!aggregate(cell)&&cell.v!==0){sum+=cell.v;expenses.push({id:`E-${r}-${c}`,date:dt,category:String(value(e,c,0)?.v??'Otros').trim(),amount:cell.v,source:'Egresos',cell:XLSX.utils.encode_cell({c,r})});}}if(sum&&typeof value(e,6,r)?.v!=='number')warnings.push(`Egresos!G${r+1}: falta el total; se sumaron los conceptos (${sum.toFixed(2)}).`);}
 const inc=wb.Sheets.Ingresos;
 if(inc){const ir=XLSX.utils.decode_range(inc['!ref']??'A1:O1');for(let r=1;r<=ir.e.r;r++){const dt=date(value(inc,1,r)?.v);for(let c=5;c<=13;c++){const cell=value(inc,c,r);if(typeof cell?.v!=='number'||!cell.v||aggregate(cell)||/Egresos!/i.test(cell.f??''))continue;const category=String(value(inc,c,0)?.v??'Otros').trim();const duplicate=expenses.some(e=>e.date===dt&&e.amount===cell.v&&(e.category.toLowerCase()===category.toLowerCase()||(e.category==='Emilio'&&category==='EMI')));if(duplicate)continue;if(!dt){warnings.push(`Ingresos!${XLSX.utils.encode_cell({c,r})}: gasto sin fecha (${cell.v}); no se incorpora.`);continue;}candidates.push({id:`I-${r}-${c}`,date:dt,category,amount:cell.v,source:'Ingresos',cell:XLSX.utils.encode_cell({c,r}),review:'Revisar clasificación y posibles duplicados'});}if(!dt)continue;const card=value(inc,2,r),cash=value(inc,3,r),transfer=value(inc,4,r);if(aggregate(card)||aggregate(cash))continue;if([card,cash,transfer].some(c=>typeof c?.v==='number'))historical.push({date:dt,card:typeof card?.v==='number'?card.v:null,cash:typeof cash?.v==='number'?cash.v:null,transfer:typeof transfer?.v==='number'?transfer.v:null,row:r+1});if(cash?.v==='250+765')warnings.push(`Ingresos!D${r+1}: “250+765” es texto, no un importe numérico.`);}}
 return {expenses,candidates,historical,warnings,tabs,readAt:new Date().toISOString()};
}
