import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function secret(): string { const key=process.env.EMAIL_UNSUBSCRIBE_SECRET; if (!key || Buffer.byteLength(key,'utf8')<32) throw Error('UNSUBSCRIBE_NOT_CONFIGURED'); return key; }
export function createUnsubscribeToken(id:string): string {
 if (!uuid.test(id)) throw Error('INVALID_RECIPIENT');
 return `${id}.${createHmac('sha256',secret()).update(`email-unsubscribe-v1:${id}`).digest('base64url')}`;
}
export function verifyUnsubscribeToken(token:string): string | null {
 const [id,signature,...extra]=token.split('.'); if(extra.length||!uuid.test(id||'')||!signature||!/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;
 const expected=createHmac('sha256',secret()).update(`email-unsubscribe-v1:${id}`).digest(); const provided=Buffer.from(signature,'base64url');
 return provided.length===expected.length && timingSafeEqual(provided,expected)?id:null;
}
export async function unsubscribe(db:Pool,token:string) {
 const id=verifyUnsubscribeToken(token); if(!id) return false;
 const c=await db.connect(); try { await c.query('BEGIN');
 const row=await c.query('SELECT address FROM email_campaign_recipients WHERE id=$1 FOR UPDATE',[id]);
 if(!row.rows.length) { await c.query('ROLLBACK'); return false; }
 const address=row.rows[0].address;
 await c.query(`INSERT INTO email_suppressions(address,source,reason) VALUES ($1,'unsubscribe','recipient request') ON CONFLICT(address) DO NOTHING`,[address]);
 await c.query(`UPDATE email_campaign_recipients SET status='SUPPRESSED' WHERE address=$1 AND status='PENDING'`,[address]);
 await c.query('COMMIT'); return true;
 } catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
