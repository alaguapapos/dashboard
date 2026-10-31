import pg from 'pg';
import {readFile} from 'node:fs/promises';
if(!process.env.POSTGRES_URL)throw Error('Missing POSTGRES_URL');
const connection=new URL(process.env.POSTGRES_URL);connection.searchParams.set('sslmode','verify-full');
if(process.env.PGSSLROOTCERT)connection.searchParams.set('sslrootcert',process.env.PGSSLROOTCERT);
const client=new pg.Client({connectionString:connection.toString(),connectionTimeoutMillis:15000});
try{await client.connect();await client.query('BEGIN');await client.query(await readFile(new URL('../supabase/migration.sql',import.meta.url),'utf8'));await client.query('COMMIT');console.log('Database schema applied.');}finally{await client.end();}
