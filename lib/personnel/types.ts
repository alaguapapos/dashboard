export type PayrollRole = 'lavador' | 'detallador';
export type WorkerRole = PayrollRole | 'administrador';
export function isPayrollRole(role:string):role is PayrollRole{return role==='lavador'||role==='detallador';}
export type Worker = {id:string; name:string; username:string; role:WorkerRole; active:number; has_pin:number};
export type Shift = {id:string; worker_id:string; role:WorkerRole; rate_cents:number; started_at:string; ended_at:string|null; request_id:string};
export type PayDay = {worker_id:string; day:string; seconds:number; cents:number; daily:boolean};
export type Audit = {id:number; shift_id:string; actor:string; reason:string; before_json:string; after_json:string; created_at:string};
export type PayPeriod = {from:string;to:string;days:PayDay[];completedCents:number;liveCents:number;openCount:number};
export type PersonnelData = {week:PayPeriod;month:PayPeriod;workers:Worker[]; inventoryAdmins:Worker[]; shifts:Shift[]; active:Shift[]; days:PayDay[]; audit:Audit[]; now:string};
export type WorkerData = {worker:Worker; shifts:Shift[]; current:Shift|null; now:string};
export const RATES:Record<WorkerRole,number> = {lavador:36000,detallador:9000,administrador:0};
export const ROLE_LABEL:Record<WorkerRole,string> = {lavador:'Lavador',detallador:'Detallador',administrador:'Administrador · sin nómina'};
