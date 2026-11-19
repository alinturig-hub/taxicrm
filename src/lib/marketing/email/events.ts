import { createVerify } from 'node:crypto';
import { eventPublicKey } from './readiness';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function verifyEventSignature(body:Buffer, timestamp:string, signature:string, publicKey:string, now=Date.now()):boolean {
 try {
  if(!/^\d{10}$/.test(timestamp) || Math.abs(now-Number(timestamp)*1000)>15*60*1000 || !signature || signature.length>512 || body.length>1_000_000) return false;
  const key=eventPublicKey(publicKey); if(key.asymmetricKeyType!=='ec') return false;
  const verifier=createVerify('sha256'); verifier.update(timestamp); verifier.update(body); verifier.end();
  return verifier.verify(key,Buffer.from(signature,'base64'));
 }catch{return false;}
}
export async function processEvents(pool:Pool, input:unknown) {
 if(!Array.isArray(input)||input.length>1000) throw Error('INVALID_EVENTS');
 const client=await pool.connect();let processed=0;
 try { await client.query('BEGIN');
  for(const e of input) {
   if(!e || typeof e!=='object' || typeof e.sg_event_id!=='string' || e.sg_event_id.length>255 || !e.sg_event_id || typeof e.event!=='string' || !UUID.test(e.taxicrm_recipient_id||'')) continue;
   const row=await client.query('SELECT id,campaign_id,address,status FROM email_campaign_recipients WHERE id=$1 FOR UPDATE',[e.taxicrm_recipient_id]);if(!row.rows.length)continue;
   const recipient=row.rows[0];
   const inserted=await client.query('INSERT INTO email_campaign_events(id,campaign_id,recipient_id,event_type,provider_event_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider_event_id) DO NOTHING RETURNING id',[randomUUID(),recipient.campaign_id,recipient.id,e.event.slice(0,80),e.sg_event_id]);
   if(!inserted.rowCount)continue;processed++;
   if(['unsubscribe','group_unsubscribe','spamreport','bounce'].includes(e.event)) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 728123))',[recipient.address]);
    await client.query(`INSERT INTO email_suppressions(address,source,reason) VALUES($1,'sendgrid',$2) ON CONFLICT(address) DO NOTHING`,[recipient.address,e.event]);
    await client.query(`UPDATE email_campaign_recipients SET status='SUPPRESSED' WHERE address=$1 AND status='PENDING'`,[recipient.address]);
   }
   if(e.event==='delivered') await client.query(`UPDATE email_campaign_recipients SET status='DELIVERED' WHERE id=$1 AND status IN ('CLAIMED','ACCEPTED','UNKNOWN')`,[recipient.id]);
   if(e.event==='bounce'||e.event==='dropped') await client.query(`UPDATE email_campaign_recipients SET status='BOUNCED' WHERE id=$1 AND status IN ('CLAIMED','ACCEPTED','UNKNOWN')`,[recipient.id]);
  }
  await client.query('COMMIT'); return processed;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
