import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { parseAudienceCsv } from './csv';
export class DraftError extends Error {}
function text(v: unknown, max: number, label: string): string { if (typeof v !== 'string' || !v.trim() || v.length > max) throw new DraftError(`Invalid ${label}`); return v.trim(); }
export async function saveTemplate(db: Pool, input: Record<string, unknown>, actor: string) {
 const name=text(input.name,120,'name'), subject=text(input.subject,200,'subject'), body=text(input.body,20000,'body');
 const id=randomUUID(); await db.query('INSERT INTO email_templates (id,name,subject,body,created_by) VALUES ($1,$2,$3,$4,$5)',[id,name,subject,body,actor]); return {id};
}
export async function saveCampaign(db: Pool, input: Record<string, unknown>, actor: string, sender: {senderEmail: string; senderName: string}) {
 const name=text(input.name,120,'name'), subject=text(input.subject,200,'subject'), body=text(input.body,20000,'body'), csv=text(input.csv,2000000,'CSV');
 const audience=parseAudienceCsv(csv); if (!audience.addresses.length) throw new DraftError('No valid addresses');
 const evidence=text(input.consentEvidence,1000,'permission evidence');
 let schedule: string|null=null; if (input.scheduleAt) { if (typeof input.scheduleAt !== 'string' || !Number.isFinite(Date.parse(input.scheduleAt))) throw new DraftError('Invalid schedule'); schedule=new Date(input.scheduleAt).toISOString(); }
 const id=randomUUID(), client=await db.connect();
 try { await client.query('BEGIN'); await client.query(`INSERT INTO email_campaigns (id,name,subject,body,sender_email,sender_name,schedule_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[id,name,subject,body,sender.senderEmail,sender.senderName,schedule,actor]);
 await client.query('INSERT INTO email_campaign_recipients (id,campaign_id,address,consent_evidence) SELECT x.id, $1, x.address, $2 FROM unnest($3::uuid[], $4::text[]) AS x(id,address)',[id,evidence,audience.addresses.map(()=>randomUUID()),audience.addresses]);
 await client.query('COMMIT'); return { id, recipients: audience.addresses.length, invalid: audience.invalid, duplicates: audience.duplicates, status:'DRAFT' };
 } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
