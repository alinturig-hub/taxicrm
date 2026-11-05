import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {conversationCursor,conversationListQuery} from './conversation-list';
test('recent messages first, empty conversations paginate without gaps, scope and formatted phone search',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`CREATE TABLE "WhatsAppConversation"(id text,scope text,participant text,mode text,revision int);
   CREATE TABLE "WhatsAppMessage"(id bigint,scope text,"conversationId" text,content jsonb);
   INSERT INTO "WhatsAppConversation" SELECT 'c'||lpad(n::text,3,'0'),'ours','+447700'||lpad(n::text,6,'0'),'AUTOMATED',0 FROM generate_series(1,105)n;
   INSERT INTO "WhatsAppConversation" VALUES ('foreign','other','+447700000001','AUTOMATED',0);
   INSERT INTO "WhatsAppMessage" VALUES (1,'ours','c001','{"text":"older"}'),(2,'ours','c002','{"text":"recent"}'),(999,'other','foreign','{}');`);
  const read=async(after='',search='')=>{const q=conversationListQuery('ours',search,after);return (await db.query<{id:string;lastMessageId:string;lastMessageText:string}>(q.text,q.values)).rows;};
  const first=await read();assert.equal(first.length,51);assert.deepEqual(first.slice(0,2).map(r=>r.id),['c002','c001']);assert.equal(first[0].lastMessageText,'recent');
  const second=await read(conversationCursor(first[49]));const third=await read(conversationCursor(second[49]));
  const ids=[...first.slice(0,50),...second.slice(0,50),...third].map(r=>r.id);
  assert.equal(ids.length,105);assert.equal(new Set(ids).size,105);assert.ok(!ids.includes('foreign'));
  assert.deepEqual((await read('','+44 (7700) 000-001')).map(r=>r.id),['c001']);
  assert.equal((await read('','%')).length,0);
 }finally{await db.close();}
});
test('reject malformed and oversized pagination cursors',()=>{
 for(const after of ['not-json',Buffer.from(JSON.stringify({id:'a',lastMessageId:'9223372036854775808'})).toString('base64url')])assert.throws(()=>conversationListQuery('ours','',after),/INVALID_CURSOR/);
 assert.throws(()=>conversationListQuery('ours','x'.repeat(101)),/INVALID_SEARCH/);
});
