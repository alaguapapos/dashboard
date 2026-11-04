// POSTGRES_URL stays in the process environment. Never pass a PIN on the command line.
// Apply schema before deployment with --schema-only. Create the account only after
// the deployed clock guards support the administrador role.
import {readFileSync} from 'node:fs';
import {scryptSync,timingSafeEqual} from 'node:crypto';
import {createPersonnelPool,runPersonnel} from '../lib/personnel/postgres.ts';
import {PersonnelError} from '../lib/personnel/errors.ts';
import {payPeriods} from '../lib/personnel/payroll.ts';

if(!process.env.POSTGRES_URL)throw Error('POSTGRES_URL is required');
const schemaOnly=process.argv.includes('--schema-only');
const username=String(process.env.INVENTORY_ADMIN_USERNAME??'').trim().toLowerCase();
const name=String(process.env.INVENTORY_ADMIN_NAME??'').trim();
const pin=String(process.env.INVENTORY_ADMIN_PIN??'');
if(!schemaOnly&&(!name||!username||!/^\d{4}$/.test(pin)))throw Error('Set INVENTORY_ADMIN_NAME, INVENTORY_ADMIN_USERNAME, and a four-digit INVENTORY_ADMIN_PIN in the process environment.');
const pool=createPersonnelPool(process.env.POSTGRES_URL);
try{
 await pool.query(readFileSync(new URL('../supabase/inventory-admin-access.sql',import.meta.url),'utf8'));
 if(schemaOnly)console.log('Inventory administrator schema ready. No accounts changed.');
 else{
  const result=await runPersonnel(pool,async store=>{
   let worker=(await store.workers()).find(w=>w.username===username);
   const created=!worker;
   if(worker){
    if(worker.role!=='administrador'||worker.name!==name||!worker.active)throw Error('An account with this username already exists with different settings. No account was changed.');
    const [{pin_hash}]=await store.rows<{pin_hash:string|null}>('SELECT pin_hash FROM personnel.workers WHERE id=$1',[worker.id]);
    const [salt,key]=(pin_hash??'').split(':');
    if(!salt||!key||!timingSafeEqual(scryptSync(pin,salt,64),Buffer.from(key,'hex')))throw Error('This account already has a different PIN. No credentials were changed.');
   }else{
    worker=await store.saveWorker({name,username,role:'administrador',active:true});
    await store.setPin(worker.id,pin);
   }
   const token=await store.login(username,pin,'inventory-admin-provision');
   if(token instanceof PersonnelError)throw token;
   const session=await store.session(token);
   await store.logout(token);
   if(session?.id!==worker.id)throw Error('Inventory access verification failed.');
   const periods=payPeriods();const report=await store.report(periods.weekFrom,periods.weekTo);
   if(report.workers.some(w=>w.id===worker.id)||report.days.some(d=>d.worker_id===worker.id))throw Error('Inventory administrator unexpectedly appears in payroll.');
   return {created,name,username,inventoryAccess:true,clockAccess:false,payrollIncluded:false,credentialVerified:true};
  });
  console.log(JSON.stringify(result));
 }
}finally{await pool.end();}
