import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { saveCampaign, saveTemplate } from './drafts';

test('synthetic database persists drafts, deduplicates contacts and does not schedule delivery', async () => {
 const db=new PGlite();
 try {
  await db.exec(await readFile('prisma/migrations/20261118120000_email_campaigns/migration.sql','utf8'));
  const adapter={query:(sql:string,args:unknown[])=>db.query(sql,args),connect:async()=>({query:(sql:string,args?:unknown[])=>db.query(sql,args),release:()=>{}})} as unknown as Pool;
  await saveTemplate(adapter,{name:'Example',subject:'Hi',body:'Hello'},'synthetic-admin');
  const draft=await saveCampaign(adapter,{name:'Test',subject:'Hi',body:'Hello',csv:'email\na@example.test\nA@example.test\ninvalid',consentEvidence:'Synthetic consent',scheduleAt:'2030-01-02T10:00:00.000Z'},'synthetic-admin',{senderEmail:'sender@example.test',senderName:'Example'});
  assert.equal(draft.status,'DRAFT');assert.equal(draft.recipients,1);assert.equal(draft.duplicates,1);assert.equal(draft.invalid,1);
  const result=await db.query<{status:string;count:string}>(`SELECT c.status,count(r.id)::text AS count FROM email_campaigns c JOIN email_campaign_recipients r ON c.id=r.campaign_id GROUP BY c.status`);
  assert.deepEqual(result.rows,[{status:'DRAFT',count:'1'}]);
  await assert.rejects(saveCampaign(adapter,{name:'x',subject:'x',body:'x',csv:'email\na@example.test'},'admin',{senderEmail:'sender@example.test',senderName:'Example'}));
 } finally { await db.close(); }
});
