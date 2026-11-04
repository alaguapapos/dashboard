import type {PostgresPersonnelStore} from '../personnel/postgres.ts';
import {PersonnelError} from '../personnel/errors.ts';
type ExpenseRecord={id:string;updated_at:string;deleted_at:string|null;deleted_by:string|null;[key:string]:unknown};
export async function changeExpenseState(store:PostgresPersonnelStore,raw:Record<string,unknown>,actor:string,action:'delete'|'restore'){
 if(typeof raw.id!=='string'||!/^[a-zA-Z0-9-]{10,64}$/.test(raw.id)||typeof raw.expected_updated_at!=='string')throw new PersonnelError('Actualiza la lista de egresos antes de continuar.',409);
 const old=(await store.rows<ExpenseRecord>('SELECT * FROM public.expenses WHERE id=$1 FOR UPDATE',[raw.id]))[0];
 if(!old)throw new PersonnelError('Egreso no encontrado.',404);
 if(old.updated_at!==raw.expected_updated_at)throw new PersonnelError('El egreso cambió. Actualiza la lista antes de continuar.',409);
 if(action==='delete'?!!old.deleted_at:!old.deleted_at)throw new PersonnelError(action==='delete'?'Este egreso ya está en Eliminados.':'Este egreso ya está activo.',409);
 const at=new Date(Math.max(Date.now(),(Date.parse(old.updated_at)||0)+1)).toISOString();
 const row=(await store.rows<ExpenseRecord>('UPDATE public.expenses SET deleted_at=$1,deleted_by=$2,updated_at=$3 WHERE id=$4 RETURNING *',[action==='delete'?at:null,action==='delete'?actor:null,at,old.id]))[0];
 await store.client.query('INSERT INTO personnel.expense_events(expense_id,actor,action,before_document,after_document) VALUES($1,$2,$3,$4,$5)',[old.id,actor,action,JSON.stringify(old),JSON.stringify(row)]);
 return {ok:true,id:row.id,updated_at:row.updated_at};
}
