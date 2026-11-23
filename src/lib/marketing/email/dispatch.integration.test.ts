import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { dispatchOne, expireClaims } from './dispatch';
const url=process.env.EMAIL_QA_DATABASE_URL;
test('PostgreSQL concurrent claims make at most one attempt per recipient; unknown never retries', {skip:!url},async()=>{
 const u=new URL(url!);if(u.hostname!=='127.0.0.1'||u.username!=='email_qa'||u.pathname!=='/email_qa') throw Error('SYNTHETIC_DB_REQUIRED');
 const owner=new Pool({connectionString:url});const schema='email_qa_'+randomUUID().replace(/-/g,'');await owner.query(`CREATE SCHEMA ${schema}`);
 const pool=new Pool({connectionString:url,max:8,options:`-c search_path=${schema}`});const old=process.env.EMAIL_UNSUBSCRIBE_SECRET;process.env.EMAIL_UNSUBSCRIBE_SECRET='synthetic-only-secret-for-testing-123456';
 try{
  await pool.query(await readFile('prisma/migrations/20261118120000_email_campaigns/migration.sql','utf8'));
  const cid=randomUUID(),rid=randomUUID();await pool.query(`INSERT INTO email_campaigns(id,name,subject,body,sender_email,sender_name,created_by,status,schedule_at) VALUES($1,'test','hi','body','sender@example.test','Test','qa','SCHEDULED',now()-interval '1 minute')`,[cid]);
  await pool.query(`INSERT INTO email_campaign_recipients(id,campaign_id,address,consent_evidence) VALUES($1,$2,'recipient@example.test','synthetic')`,[rid,cid]);
  let calls=0;const fake:typeof fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.sendgrid.com/v3/mail/send');const body=JSON.parse(String(init?.body));assert.equal(body.personalizations[0].custom_args.taxicrm_recipient_id,rid);assert.match(body.content[0].value,/Unsubscribe:/);await new Promise(r=>setTimeout(r,50));throw Error('synthetic timeout');};
  const sender={senderEmail:'sender@example.test',senderName:'Test',apiKey:'synthetic'};
  const result=await Promise.all([dispatchOne(pool,sender,'https://example.test',fake),dispatchOne(pool,sender,'https://example.test',fake)]);
  assert.equal(calls,1);assert.ok(result.some(x=>x.state==='UNKNOWN'));assert.equal((await dispatchOne(pool,sender,'https://example.test',fake)).state,'EMPTY');assert.equal(calls,1);
  const accepted=randomUUID(),suppressed=randomUUID();
  await pool.query(`INSERT INTO email_campaign_recipients(id,campaign_id,address,consent_evidence) VALUES($1,$3,'accepted@example.test','synthetic'),($2,$3,'suppressed@example.test','synthetic')`,[accepted,suppressed,cid]);
  await pool.query(`INSERT INTO email_suppressions(address,source,reason) VALUES('suppressed@example.test','test','test')`);
  const fakeAccepted:typeof fetch=async()=>{calls++;return new Response(null,{status:202,headers:{'x-message-id':'synthetic-id'}});};
  assert.equal((await dispatchOne(pool,sender,'https://example.test',fakeAccepted)).state,'ACCEPTED');
  assert.equal((await dispatchOne(pool,sender,'https://example.test',fakeAccepted)).state,'EMPTY');assert.equal(calls,2);
  assert.equal((await pool.query('SELECT status FROM email_campaign_recipients WHERE id=$1',[suppressed])).rows[0].status,'PENDING');
  const retained = randomUUID(), removed = randomUUID();
  await pool.query(
    `INSERT INTO email_campaign_recipients(id,campaign_id,address,consent_evidence)
      VALUES($1,$3,'retained@example.test','synthetic'),($2,$3,'removed@example.test','synthetic')`,
    [retained, removed, cid],
  );
  const newDefault = { senderEmail: 'new@example.test', senderName: 'New default', apiKey: sender.apiKey };
  const retainedSender = { ...newDefault, additionalSenders: [{ senderEmail: sender.senderEmail, senderName: sender.senderName }] };
  const verifyFrom: typeof fetch = async (_url, init) => {
    calls++;
    assert.deepEqual(JSON.parse(String(init?.body)).from, { email: sender.senderEmail, name: sender.senderName });
    return new Response(null, { status: 202 });
  };
  assert.equal((await dispatchOne(pool, retainedSender, 'https://example.test', verifyFrom)).state, 'ACCEPTED');
  assert.equal((await dispatchOne(pool, newDefault, 'https://example.test', verifyFrom)).state, 'SENDER_CHANGED');
  assert.equal(calls, 3);
  await pool.query(`UPDATE email_campaign_recipients SET status='CLAIMED',claimed_at=now()-interval '6 minutes' WHERE id=$1`,[rid]);await expireClaims(pool);
  assert.equal((await pool.query('SELECT status FROM email_campaign_recipients WHERE id=$1',[rid])).rows[0].status,'UNKNOWN');
 }finally{await pool.end();await owner.query(`DROP SCHEMA ${schema} CASCADE`);await owner.end();if(old===undefined)delete process.env.EMAIL_UNSUBSCRIBE_SECRET;else process.env.EMAIL_UNSUBSCRIBE_SECRET=old;}
});
