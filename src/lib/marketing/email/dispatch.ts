import type { Pool } from 'pg';
import { claimNextRecipient } from './dispatch-claim';
import { createUnsubscribeToken } from './unsubscribe';

type Sender={senderEmail:string;senderName:string;apiKey:string};
/** An interrupted or ambiguous claim must never be automatically retried. */
export async function expireClaims(pool:Pool) {
 return pool.query(`UPDATE email_campaign_recipients SET status='UNKNOWN' WHERE status='CLAIMED' AND claimed_at < now() - interval '5 minutes'`);
}
/** Mark suppressed recipients and close campaigns only when no outcome is unresolved. */
export async function finishSettledCampaigns(pool:Pool) {
 await pool.query(`UPDATE email_campaign_recipients r SET status='SUPPRESSED' FROM email_campaigns c WHERE r.campaign_id=c.id AND c.status='SCHEDULED' AND r.status='PENDING' AND EXISTS (SELECT 1 FROM email_suppressions s WHERE s.address=r.address)`);
 await pool.query(`UPDATE email_campaigns c SET status='COMPLETED',updated_at=now() WHERE c.status='SCHEDULED' AND c.schedule_at<=now() AND NOT EXISTS (SELECT 1 FROM email_campaign_recipients r WHERE r.campaign_id=c.id AND r.status IN ('PENDING','CLAIMED','UNKNOWN'))`);
}
/** Run a single delivery. Provider calls are intentionally never retried. */
export async function dispatchOne(pool:Pool,sender:Sender,baseUrl:string,transport:typeof fetch=fetch, campaignId?:string) {
 const url=new URL(baseUrl); if(url.protocol!=='https:'||url.username||url.password) throw Error('INVALID_PUBLIC_URL');
 // Check configuration before claiming work, so missing keys do not strand recipients.
 createUnsubscribeToken('00000000-0000-4000-8000-000000000000');
 const row=await claimNextRecipient(pool,campaignId); if(!row) return {state:'EMPTY'};
 const db=await pool.connect(); let called=false;
 try {
  await db.query('BEGIN');
  const current=await db.query(`SELECT r.status,c.status AS campaign_status,c.sender_email,c.sender_name FROM email_campaign_recipients r JOIN email_campaigns c ON c.id=r.campaign_id WHERE r.id=$1 FOR UPDATE OF c,r`,[row.id]);
  const state=current.rows[0];
  if(!state||state.status!=='CLAIMED'||state.campaign_status!==(campaignId?'PAUSED':'SCHEDULED')) { if(state?.status==='CLAIMED') await db.query(`UPDATE email_campaign_recipients SET status='PENDING',claimed_at=NULL WHERE id=$1`,[row.id]); await db.query('COMMIT');return {state:'PAUSED'}; }
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 728123))',[row.address]);
  const suppressed=await db.query('SELECT 1 FROM email_suppressions WHERE address=$1',[row.address]);
  if(suppressed.rowCount) { await db.query(`UPDATE email_campaign_recipients SET status='SUPPRESSED' WHERE id=$1`,[row.id]);await db.query('COMMIT');return {state:'SUPPRESSED'}; }
  if(state.sender_email!==sender.senderEmail||state.sender_name!==sender.senderName) {await db.query(`UPDATE email_campaign_recipients SET status='REJECTED' WHERE id=$1`,[row.id]);await db.query('COMMIT');return {state:'SENDER_CHANGED'};}
  const link=new URL('/api/marketing/email/unsubscribe',url);link.searchParams.set('token',createUnsubscribeToken(row.id));
  let result:'ACCEPTED'|'REJECTED'|'UNKNOWN'='UNKNOWN';let messageId:string|null=null;
  try {
   called=true;const response=await transport('https://api.sendgrid.com/v3/mail/send',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{authorization:`Bearer ${sender.apiKey}`,'content-type':'application/json'},body:JSON.stringify({personalizations:[{to:[{email:row.address}],custom_args:{taxicrm_recipient_id:row.id}}],from:{email:sender.senderEmail,name:sender.senderName},subject:row.subject,content:[{type:'text/plain',value:`${row.body}\n\nUnsubscribe: ${link.toString()}`}],headers:{'List-Unsubscribe':`<${link.toString()}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})});
   result=response.status===202?'ACCEPTED':[400,401,403,404,413,422].includes(response.status)?'REJECTED':'UNKNOWN';
   const value=response.headers.get('x-message-id'); if(value && /^[A-Za-z0-9._-]{1,255}$/.test(value))messageId=value;
  } catch { result='UNKNOWN'; }
  await db.query('UPDATE email_campaign_recipients SET status=$2,provider_message_id=$3 WHERE id=$1 AND status=\'CLAIMED\'',[row.id,result,messageId]);if(campaignId)await db.query("UPDATE email_campaigns SET status='COMPLETED',updated_at=now() WHERE id=$1 AND status='PAUSED'",[campaignId]);await db.query('COMMIT');return {state:result};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(called) return {state:'UNKNOWN'};throw e;}finally{db.release();}
}
