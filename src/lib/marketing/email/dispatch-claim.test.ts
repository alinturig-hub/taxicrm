import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { claimNextRecipient } from './dispatch-claim';
test('durable claim ignores suppressed and draft recipients and cannot claim twice',async()=>{
 const db=new PGlite();try{
 await db.exec(await readFile('prisma/migrations/20261118120000_email_campaigns/migration.sql','utf8'));
 const campaign=randomUUID(),good=randomUUID(),blocked=randomUUID();
 await db.query(`INSERT INTO email_campaigns(id,name,subject,body,sender_email,sender_name,created_by,status,schedule_at) VALUES($1,'t','t','t','s@example.test','t','t','SCHEDULED',now()-interval '1 minute')`,[campaign]);
 await db.query(`INSERT INTO email_campaign_recipients(id,campaign_id,address,consent_evidence) VALUES($1,$3,'a@example.test','synthetic'),($2,$3,'b@example.test','synthetic')`,[good,blocked,campaign]);
 await db.query(`INSERT INTO email_suppressions(address,source,reason) VALUES('b@example.test','synthetic','test')`);
 const pool={connect:async()=>({query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}})} as unknown as Pool;
 assert.equal((await claimNextRecipient(pool)).id,good);assert.equal(await claimNextRecipient(pool),null);
 assert.equal((await db.query<{status:string}>('SELECT status FROM email_campaign_recipients WHERE id=$1',[good])).rows[0].status,'CLAIMED');
 }finally{await db.close();}
});
