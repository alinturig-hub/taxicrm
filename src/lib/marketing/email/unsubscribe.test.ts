import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { createUnsubscribeToken, verifyUnsubscribeToken, unsubscribe } from './unsubscribe';
test('signed unsubscribe suppresses pending messages without changing accepted messages',async()=>{
 const previous=process.env.EMAIL_UNSUBSCRIBE_SECRET;process.env.EMAIL_UNSUBSCRIBE_SECRET='synthetic-only-secret-for-testing-123456';const db=new PGlite();
 try {
  await db.exec(await readFile('prisma/migrations/20261118120000_email_campaigns/migration.sql','utf8'));
  const cid=randomUUID(),rid=randomUUID(),other=randomUUID();
  await db.query(`INSERT INTO email_campaigns(id,name,subject,body,sender_email,sender_name,created_by) VALUES ($1,'test','test','test','sender@example.test','test','test')`,[cid]);
  await db.query(`INSERT INTO email_campaign_recipients(id,campaign_id,address,consent_evidence,status) VALUES($1,$2,'user@example.test','synthetic','PENDING'),($3,$2,'other@example.test','synthetic','ACCEPTED')`,[rid,cid,other]);
  const adapter={connect:async()=>({query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}})} as unknown as Pool;
  const token=createUnsubscribeToken(rid);assert.equal(verifyUnsubscribeToken(token),rid);assert.equal(verifyUnsubscribeToken(token+'x'),null);
  assert.equal(await unsubscribe(adapter,token),true);assert.equal(await unsubscribe(adapter,token),true);
  assert.deepEqual((await db.query<{status:string}>('SELECT status FROM email_campaign_recipients WHERE id=$1',[rid])).rows,[{status:'SUPPRESSED'}]);
  assert.equal((await db.query('SELECT * FROM email_suppressions')).rows.length,1);
 }finally{await db.close();if(previous===undefined)delete process.env.EMAIL_UNSUBSCRIBE_SECRET;else process.env.EMAIL_UNSUBSCRIBE_SECRET=previous;}
});
