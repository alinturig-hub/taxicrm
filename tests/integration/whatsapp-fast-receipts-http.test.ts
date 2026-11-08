import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
const dbUrl=process.env.WHATSAPP_TEST_DATABASE_URL,base=process.env.WHATSAPP_TEST_HTTP_ORIGIN;
test('synthetic signed webhook appears in shared inbox through the running fast worker',{skip:!dbUrl||!base},async()=>{
 const db=new URL(dbUrl!),host=new URL(base!);if(db.hostname!=='127.0.0.1'||db.port!=='55439'||db.username!=='whatsapp_qa'||host.origin!=='http://127.0.0.1:4141')throw Error('TEST_ENDPOINTS_MUST_BE_ISOLATED_LOCAL_QA');
 const pool=new Pool({connectionString:dbUrl});try{
 const id='wamid.fast.http.'+randomUUID(),body=JSON.stringify({object:'whatsapp_business_account',entry:[{id:'123456',changes:[{field:'messages',value:{metadata:{phone_number_id:'789012'},messages:[{id,from:'447700900321',type:'text',text:{body:'Synthetic fast webhook'},timestamp:String(Math.floor(Date.now()/1000))}]}}]}]});
 const sig='sha256='+createHmac('sha256','synthetic-test-secret-000000000000').update(body).digest('hex');const before=(await pool.query(`SELECT count(*)::int AS n FROM "WhatsAppOutboundMessage"`)).rows[0].n;
 const start=Date.now();const result=await fetch(base+'/api/webhooks/whatsapp/meta',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':sig},body});assert.equal(result.status,200);
 let found=false;for(let i=0;i<100;i++){found=!!(await pool.query(`SELECT 1 FROM "WhatsAppMessage" WHERE "providerMessageId"=$1 AND direction='INBOUND'`,[id])).rowCount;if(found)break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(found,true,'receipt should become visible within ten seconds in the isolated test');assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "WhatsAppOutboundMessage"`)).rows[0].n,before);console.log('Synthetic webhook to inbox:',Date.now()-start,'ms');
 }finally{await pool.end()}
});
