import {seedServiceBindings} from './service-defaults';
import {sharedPool,sharedScope,transaction,materialize} from './shared';
import {signedHeaders} from './service-auth';
/** Bounded batch; database claims make concurrent worker runs safe. No Meta transport here. */
export async function processSharedReceipts(){
 if(process.env.WHATSAPP_SHARED_ENABLED!=='true')return {processed:0};const scope=sharedScope();await transaction(db=>seedServiceBindings(db,scope));let processed=0;
 for(let i=0;i<100;i++){let receiptId:string|undefined;try{
 const done=await transaction(async db=>{const row=(await db.query(`SELECT id,"rawBody" FROM "WhatsAppWebhookInbox" WHERE "connectionKey"=$1 AND status='RECEIVED' AND "attemptCount"<5 ORDER BY "receivedAt",id FOR UPDATE SKIP LOCKED LIMIT 1`,['META:'+process.env.META_WHATSAPP_WABA_ID])).rows[0];if(!row)return false;receiptId=row.id;
 await materialize(db,scope,row.rawBody,process.env.META_WHATSAPP_WABA_ID!,process.env.META_WHATSAPP_PHONE_NUMBER_ID!);
 await db.query(`UPDATE "WhatsAppWebhookInbox" SET status='PROCESSED',"processedAt"=now(),"attemptCount"="attemptCount"+1 WHERE id=$1`,[row.id]);return true;});if(!done)break;processed++;
 }catch(error){if(!receiptId)throw error;await sharedPool().query(`UPDATE "WhatsAppWebhookInbox" SET "attemptCount"="attemptCount"+1,status=CASE WHEN "attemptCount">=4 THEN 'FAILED' ELSE status END WHERE id=$1 AND status='RECEIVED'`,[receiptId]);}}

 await sharedPool().query(`UPDATE "WhatsAppServiceIntent" SET status='EXPIRED' WHERE scope=$1 AND status='HELD' AND "expiresAt"<now()`,[scope]);
 await sharedPool().query(`DELETE FROM "WhatsAppServiceNonce" WHERE "createdAt"<now()-interval '1 day'`);return {processed};
}
export async function deliverSharedEvents(fetcher:typeof fetch=fetch){
 if(process.env.WHATSAPP_SHARED_ENABLED!=='true')return {delivered:0};const scope=sharedScope();
 // Fixed configured origin only. Never accept callback URLs from message intents.
 const url=new URL('/api/internal/whatsapp/v1/events',process.env.WHATSAPP_NAC_ORIGIN);if(url.protocol!=='https:'||url.username||url.password)throw Error('INVALID_CONSUMER_ORIGIN');
 const key=process.env.WHATSAPP_CRM_KEY_ID||'',secret=process.env.WHATSAPP_CRM_SECRET||'';if(!key||secret.length<32)throw Error('WHATSAPP_SERVICE_NOT_CONFIGURED');let delivered=0;
 for(let i=0;i<10;i++){
 const row=await transaction(async db=>{const r=(await db.query(`SELECT * FROM "WhatsAppSharedEvent" WHERE scope=$1 AND "deliveredAt" IS NULL AND attempts<12 AND "nextAttemptAt"<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`,[scope])).rows[0];if(r)await db.query(`UPDATE "WhatsAppSharedEvent" SET attempts=attempts+1,"nextAttemptAt"=now()+interval '60 seconds' WHERE id=$1`,[r.id]);return r;});if(!row)break;
 const body=JSON.stringify({schema_version:'1.0',event_id:String(row.id),scope:row.scope,type:row.type,payload:row.payload});let ok=false;
 try{ok=(await fetcher(url,{method:'POST',body,headers:{'Content-Type':'application/json',...signedHeaders('POST',url.pathname,body,key,secret)},redirect:'error',signal:AbortSignal.timeout(8000)})).ok;}catch{/* Same event ID remains durable and retries later. */}
 if(ok){await sharedPool().query(`UPDATE "WhatsAppSharedEvent" SET "deliveredAt"=now() WHERE id=$1`,[row.id]);delivered++;}else await sharedPool().query(`UPDATE "WhatsAppSharedEvent" SET "nextAttemptAt"=now()+($2*interval '1 second') WHERE id=$1`,[row.id,Math.min(3600,2**(row.attempts+1)*10)+Math.floor(Math.random()*10)]);
 }return {delivered};
}
