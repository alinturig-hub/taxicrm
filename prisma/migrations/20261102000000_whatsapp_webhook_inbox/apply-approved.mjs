// Explicit operator-approved maintenance only. Never imported by application startup.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {Client}=createRequire(import.meta.url)('pg');
let client;
try {
 const url=new URL(process.env.DATABASE_URL);
 if(url.hostname!=='q9fahphg3lydu18inysgmerq'||url.pathname!=='/postgres')throw Error('DATABASE_IDENTITY_MISMATCH');
 client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
 await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='5s'");await client.query("SET LOCAL statement_timeout='30s'");
 const identity=(await client.query('SELECT current_user')).rows[0];
 if(identity.current_user!=='taxicrm_shared_app')throw Error('ROLE_MISMATCH');
 await client.query(readFileSync(new URL('./migration.sql',import.meta.url),'utf8'));
 await client.query('COMMIT');console.log('META_INBOX_MIGRATION_APPLIED');
} catch(error) {
 if(client)await client.query('ROLLBACK').catch(()=>{});
 console.log('META_INBOX_MIGRATION_FAILED',error.code||'IDENTITY_OR_SCHEMA_CHECK');process.exitCode=1;
} finally {if(client)await client.end();}
