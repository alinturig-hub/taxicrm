import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { verifyEventSignature, processEvents } from './events';
test('event signature checks payload and timestamp',()=>{
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const time='1800000000',raw=Buffer.from('[{"event":"delivered"}]');
 const signer=createSign('sha256');signer.update(time);signer.update(raw);signer.end();const sig=signer.sign(keys.privateKey).toString('base64'),pub=keys.publicKey.export({type:'spki',format:'pem'}).toString();
 assert.equal(verifyEventSignature(raw,time,sig,pub,1800000000000),true);assert.equal(verifyEventSignature(Buffer.from('[]'),time,sig,pub,1800000000000),false);assert.equal(verifyEventSignature(raw,time,sig,pub,1800001000000),false);
});
test('signed event processing deduplicates and suppresses bounced recipients',async()=>{
 const db=new PGlite();try{
 await db.exec(await readFile('prisma/migrations/20261118120000_email_campaigns/migration.sql','utf8'));const cid=randomUUID(),rid=randomUUID();
 await db.query(`INSERT INTO email_campaigns(id,name,subject,body,sender_email,sender_name,created_by) VALUES ($1,'t','t','t','s@example.test','t','t')`,[cid]);
 await db.query(`INSERT INTO email_campaign_recipients(id,campaign_id,address,consent_evidence,status) VALUES($1,$2,'a@example.test','synthetic','ACCEPTED')`,[rid,cid]);
 const adapter={connect:async()=>({query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}})} as unknown as Pool;
 const event={event:'bounce',sg_event_id:'synthetic-event',taxicrm_recipient_id:rid};assert.equal(await processEvents(adapter,[event,event]),1);assert.equal(await processEvents(adapter,[event]),0);
 assert.equal((await db.query<{status:string}>('SELECT status FROM email_campaign_recipients')).rows[0].status,'BOUNCED');assert.equal((await db.query('SELECT * FROM email_suppressions')).rows.length,1);
 }finally{await db.close();}
});
