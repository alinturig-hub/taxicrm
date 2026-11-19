import type { Pool } from 'pg';
/** Claim one due recipient durably. This function does not call a provider. */
export async function claimNextRecipient(pool: Pool) {
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const result=await client.query(`
   SELECT r.id, r.campaign_id, r.address, c.name, c.subject, c.body, c.sender_email, c.sender_name
   FROM email_campaign_recipients r
   JOIN email_campaigns c ON c.id=r.campaign_id
   WHERE c.status='SCHEDULED' AND c.schedule_at <= now() AND r.status='PENDING'
     AND length(trim(r.consent_evidence))>0
     AND NOT EXISTS (SELECT 1 FROM email_suppressions s WHERE s.address=r.address)
   ORDER BY c.schedule_at, r.id
   FOR UPDATE OF r SKIP LOCKED LIMIT 1`);
  if(!result.rows.length){await client.query('COMMIT');return null;}
  const row=result.rows[0];
  await client.query(`UPDATE email_campaign_recipients SET status='CLAIMED', claimed_at=now() WHERE id=$1 AND status='PENDING'`,[row.id]);
  await client.query('COMMIT');return row;
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
