import { createHash,randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { dispatchOne } from './dispatch';
export const ownerTestSubject='TaxiCRM email campaign test';
export const ownerTestBody='Hello,\n\nThis is a single test email from your TaxiCRM campaign system.\n\nThank you.';
export type TestConfig={enabled:boolean;recipient:string;nonce:string;globalEnabled:boolean};
export function testConfig(env:Readonly<Record<string,string|undefined>>=process.env):TestConfig {
 const recipient=(env.EMAIL_OWNER_TEST_RECIPIENT||'').trim().toLowerCase(),nonce=env.EMAIL_OWNER_TEST_NONCE||'',expires=Date.parse(env.EMAIL_OWNER_TEST_EXPIRES_AT||'');
 return {enabled:env.EMAIL_OWNER_TEST_ENABLED==='true'&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)&&recipient.length<=254&&nonce.length>=32&&Number.isFinite(expires)&&expires>Date.now()&&expires<=Date.now()+24*3600000,recipient,nonce,globalEnabled:env.EMAIL_CAMPAIGNS_ENABLED==='true'};
}
type Sender={senderEmail:string;senderName:string;apiKey:string};
export async function runOwnerTest(pool:Pool,config:TestConfig,recipient:string,actor:string,sender:Sender,baseUrl:string,transport:typeof fetch=fetch) {
 if(!config.enabled||config.globalEnabled||recipient.trim().toLowerCase()!==config.recipient||!actor)throw Error('TEST_NOT_ALLOWED');
 const id=randomUUID(),rid=randomUUID(),sentinel='owner-test:'+createHash('sha256').update(config.nonce).digest('hex');const c=await pool.connect();
 try {await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 728123))',[config.recipient]);
  const previous=await c.query('SELECT 1 FROM email_campaign_events WHERE provider_event_id=$1',[sentinel]);if(previous.rowCount){await c.query('ROLLBACK');return {state:'ALREADY_CLAIMED'};}
  const blocked=await c.query('SELECT 1 FROM email_suppressions WHERE address=$1',[config.recipient]);if(blocked.rowCount){await c.query('ROLLBACK');return {state:'SUPPRESSED'};}
  await c.query(`INSERT INTO email_campaigns(id,name,subject,body,sender_email,sender_name,schedule_at,status,created_by) VALUES($1,'Owner delivery test',$2,$3,$4,$5,now(),'PAUSED',$6)`,[id,ownerTestSubject,ownerTestBody,sender.senderEmail,sender.senderName,actor]);
  await c.query(`INSERT INTO email_campaign_recipients(id,campaign_id,address,consent_evidence) VALUES($1,$2,$3,'Owner-requested test')`,[rid,id,config.recipient]);
  await c.query(`INSERT INTO email_campaign_events(id,campaign_id,recipient_id,event_type,provider_event_id) VALUES($1,$2,$3,'OWNER_TEST_CLAIMED',$4)`,[randomUUID(),id,rid,sentinel]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 // A crash after the durable claim leaves this test non-retryable, even before a provider call.
 try {const result=await dispatchOne(pool,sender,baseUrl,transport,id);return {...result,campaignId:id};}catch{return {state:'UNKNOWN',campaignId:id};}
}
