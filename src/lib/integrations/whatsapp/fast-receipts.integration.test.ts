import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {processFastReceipts,processSharedReceipts} from './shared-worker';
import {sharedPool} from './shared';
import {POST} from '../../../app/api/internal/whatsapp/v1/worker/receipts/route';
const url=process.env.WHATSAPP_TEST_DATABASE_URL;
test('fast receipt path is disabled by default, authenticated, durable and never dispatches',{skip:!url},async()=>{
 const u=new URL(url!);if(u.hostname!=='127.0.0.1'||u.port!=='55439'||u.username!=='whatsapp_qa')throw Error('TEST_DATABASE_MUST_BE_ISOLATED_LOCAL_QA');
 Object.assign(process.env,{DATABASE_URL:url,WHATSAPP_SHARED_ENABLED:'true',WHATSAPP_RECEIPT_FAST_ENABLED:'false',WHATSAPP_WORKSPACE_ID:'fleet',META_WHATSAPP_WABA_ID:'123456',META_WHATSAPP_PHONE_NUMBER_ID:'789012',WHATSAPP_WORKER_SECRET:'s'.repeat(48)});
 const pool=new Pool({connectionString:url});try{
 for(const name of ['20261102000000_whatsapp_webhook_inbox','20261103000000_whatsapp_outbound','20261104000000_whatsapp_shared','20261104010000_whatsapp_dispatch'])await pool.query(readFileSync(new URL(`../../../../prisma/migrations/${name}/migration.sql`,import.meta.url),'utf8'));
 const envelope=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'123456',changes:[{field:'messages',value:{metadata:{phone_number_id:'789012'},messages:[{id:'wamid.fast.synthetic',from:'447700900123',type:'text',text:{body:'Synthetic hello'},timestamp:String(Math.floor(Date.now()/1000))}]}}]}]});
 await pool.query(`INSERT INTO "WhatsAppWebhookInbox" (id,"connectionKey","bodyHash","rawBody") VALUES ('receipt-1','META:123456','hash-1',$1)`,[envelope]);
 assert.deepEqual(await processFastReceipts(),{processed:0});const request=(secret:string)=>new Request('http://localhost/receipts',{method:'POST',headers:{'x-whatsapp-worker-secret':secret}});
 assert.equal((await POST(request('wrong'))).status,401);assert.equal((await POST(request('s'.repeat(48)))).status,503);
 process.env.WHATSAPP_RECEIPT_FAST_ENABLED='true';const results=await Promise.all([processFastReceipts(),processSharedReceipts()]);assert.equal(results.reduce((n,x)=>n+x.processed,0),1);
 assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "WhatsAppMessage" WHERE direction='INBOUND'`)).rows[0].n,1);assert.equal((await pool.query(`SELECT status FROM "WhatsAppWebhookInbox"`)).rows[0].status,'PROCESSED');assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "WhatsAppOutboundMessage"`)).rows[0].n,0);assert.deepEqual(await processFastReceipts(),{processed:0});
 const conversation=(await pool.query(`SELECT id,scope FROM "WhatsAppConversation"`)).rows[0];
 await pool.query(`INSERT INTO "WhatsAppServiceIntent" (id,scope,"operationKey","requestHash","conversationId",payload,status,"expiresAt") VALUES ('held-1',$1,'synthetic-op','hash',$2,'{}','HELD',now()+interval '1 hour')`,[conversation.scope,conversation.id]);
 const stop=JSON.parse(envelope);stop.entry[0].changes[0].value.messages[0].id='wamid.stop.synthetic';stop.entry[0].changes[0].value.messages[0].text.body='STOP';
 await pool.query(`INSERT INTO "WhatsAppWebhookInbox" (id,"connectionKey","bodyHash","rawBody") VALUES ('receipt-2','META:123456','hash-2',$1)`,[JSON.stringify(stop)]);
 assert.deepEqual(await processFastReceipts(),{processed:1});assert.equal((await pool.query(`SELECT status FROM "WhatsAppServiceIntent" WHERE id='held-1'`)).rows[0].status,'CANCELLED');assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "WhatsAppOutboundMessage"`)).rows[0].n,0);
 }finally{await pool.end();await sharedPool().end()}
});
