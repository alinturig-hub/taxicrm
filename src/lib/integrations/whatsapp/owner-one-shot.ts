import {createHash} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {conversation,sharedScope,stable} from './shared';
import {enqueueOutbound,claimOutbound} from './outbox';
import {positionalTemplatePayload,templateFingerprint,type ProviderTemplate} from './operational-adapters';
import {sendMetaPayload} from './meta-send';
import {whatsappCredentials,WhatsAppError} from './settings';
import {boundedJson} from './templates';
export const ownerTestReference='SYNTHETIC-OWNER-TEST-20261105';
export type OwnerPacket={version:1;database:{host:string;port:string;name:string;role:string};purpose:'OWNER_ONLY_TRANSPORT_TEST';recipient:string;scope:string;appId:string;wabaId:string;phoneId:string;expiresAt:string;operationKey:string;template:ProviderTemplate;templateFingerprint:string;payload:ReturnType<typeof positionalTemplatePayload>;payloadSha256:string;renderedText:string;maximumProviderPosts:1;automaticRetries:0;smsFallback:false};
export const packetHash=(p:OwnerPacket)=>createHash('sha256').update(stable(p)).digest('hex');
const payloadHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function prepareOwnerPacket(recipient:string,template:ProviderTemplate,env:NodeJS.ProcessEnv,expiresAt:string):OwnerPacket{
 if(!/^\+[1-9]\d{7,14}$/.test(recipient)||template.name!=='nac_booking_confirmation_v1'||template.language!=='en_GB'||template.category!=='UTILITY'||template.status!=='APPROVED'||template.components.length!==1||template.components[0].type!=='BODY'||typeof template.components[0].text!=='string'||!template.components[0].text.includes('{{1}}')||/[{}]/.test(template.components[0].text.replace(/\{\{1\}\}/g,''))||(template.parameter_format||'POSITIONAL')!=='POSITIONAL')throw Error('OWNER_TEST_TEMPLATE_INVALID');
 const databaseUrl=new URL(env.DATABASE_URL||'');const database={host:databaseUrl.hostname,port:databaseUrl.port||'5432',name:decodeURIComponent(databaseUrl.pathname.slice(1)),role:decodeURIComponent(databaseUrl.username)};
 const scope=sharedScope(env),payload=positionalTemplatePayload(recipient,template.name,template.language,[ownerTestReference]);
 return {version:1,database,purpose:'OWNER_ONLY_TRANSPORT_TEST',recipient,scope,appId:env.META_WHATSAPP_APP_ID!,wabaId:env.META_WHATSAPP_WABA_ID!,phoneId:env.META_WHATSAPP_PHONE_NUMBER_ID!,expiresAt,operationKey:'owner-transport-v1:'+createHash('sha256').update(scope+'|'+recipient+'|'+ownerTestReference).digest('hex'),template,templateFingerprint:templateFingerprint(template),payload,payloadSha256:payloadHash(payload),renderedText:template.components[0].text.replace(/\{\{1\}\}/g,ownerTestReference),maximumProviderPosts:1,automaticRetries:0,smsFallback:false};
}
export async function readOwnerTemplate(env:NodeJS.ProcessEnv,fetcher:typeof fetch=fetch){
 const c=whatsappCredentials(env),url=new URL(`https://graph.facebook.com/${c.graphVersion}/${c.wabaId}/message_templates`);url.searchParams.set('name','nac_booking_confirmation_v1');url.searchParams.set('fields','id,name,status,category,language,parameter_format,components');url.searchParams.set('limit','25');
 const response=await fetcher(url,{method:'GET',headers:{Authorization:`Bearer ${c.accessToken}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('OWNER_TEST_APPROVAL_UNAVAILABLE');
 const data=await boundedJson(response),found=(Array.isArray(data.data)?data.data:[]).filter(t=>t.name==='nac_booking_confirmation_v1'&&t.language==='en_GB');if(found.length!==1)throw Error('OWNER_TEST_TEMPLATE_INVALID');return found[0] as ProviderTemplate;
}
function approved(p:OwnerPacket,env:NodeJS.ProcessEnv){
 if(env.OWNER_TEST_APPROVED_PACKET_SHA256!==packetHash(p)||env.OWNER_TEST_CONFIRMED_RECIPIENT!==p.recipient)throw Error('OWNER_TEST_NOT_APPROVED');
 if(['META_WHATSAPP_SENDING_ENABLED','WHATSAPP_JOURNEY_SENDING_ENABLED','META_WHATSAPP_TEST_SEND_ENABLED'].some(k=>env[k]!=='false'))throw Error('OWNER_TEST_WORKERS_MUST_REMAIN_DISABLED');
 const expected=prepareOwnerPacket(p.recipient,p.template,env,p.expiresAt);if(stable(expected)!==stable(p))throw Error('OWNER_TEST_PACKET_CHANGED');
 const deadline=Date.parse(p.expiresAt);if(!Number.isFinite(deadline)||deadline<=Date.now()||deadline>Date.now()+86400000)throw Error('OWNER_TEST_EXPIRED');
}
async function permitted(db:PoolClient,scope:string,recipient:string,conversationId:string){
 const grant=(await db.query('SELECT suppressed,"serviceAllowed" FROM "WhatsAppRecipientGrant" WHERE scope=$1 AND recipient=$2',[scope,recipient])).rows[0];
 if(grant?.suppressed||grant?.serviceAllowed===false)throw Error('OWNER_TEST_RECIPIENT_BLOCKED');
 const current=(await db.query('SELECT mode FROM "WhatsAppConversation" WHERE scope=$1 AND id=$2',[scope,conversationId])).rows[0];if(current?.mode!=='AUTOMATED')throw Error('OWNER_TEST_OPERATOR_TAKEOVER');
}
/** Internal one-shot only; no API/worker route. Explicit approval is narrowly bound to this packet.
 * Owner permission is for this test alone; no general recipient grant or canonical booking is created.
 */
export async function runOwnerOneShot(p:OwnerPacket,pool:Pool,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 approved(p,env);const c=whatsappCredentials(env),snapshot=await readOwnerTemplate(env,fetcher);if(templateFingerprint(snapshot)!==p.templateFingerprint)throw Error('OWNER_TEST_TEMPLATE_CHANGED');
 const db=await pool.connect();let lock:string|undefined;
 try{
  const identity=(await db.query('SELECT current_database() AS name,current_user AS role')).rows[0];if(identity?.name!==p.database.name||identity?.role!==p.database.role)throw Error('OWNER_TEST_DATABASE_MISMATCH');
  await db.query('BEGIN');let conv;try{conv=await conversation(db,p.scope,p.recipient);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e}
  lock=p.scope+':conversation:'+conv.id;await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);
  await permitted(db,p.scope,p.recipient,conv.id);approved(p,env);
  if((await db.query('SELECT id FROM "WhatsAppOutboundMessage" WHERE "connectionKey"=$1 AND "operationKey"=$2',[p.scope,p.operationKey])).rows.length)throw Error('OWNER_TEST_ALREADY_ATTEMPTED');
  await db.query('BEGIN');let outbound;
  try{
   outbound=await enqueueOutbound(db,{connectionKey:p.scope,operationKey:p.operationKey,actorUserId:'owner-approved-transport-test',recipient:p.recipient,templateSnapshot:{name:p.template.name,language:p.template.language,parameters:[ownerTestReference],body:p.template.components[0].text,metaId:p.template.id,packetHash:packetHash(p)},purpose:'SERVICE',eligibilityEvidence:{purpose:p.purpose,permission:'OWNER_APPROVED_SINGLE_TEST_ONLY',approvalHash:packetHash(p),expiresAt:p.expiresAt}});
   if(!await claimOutbound(db,p.scope,outbound.id))throw Error('OWNER_TEST_ALREADY_ATTEMPTED');await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}
  let calls=0;
  const onePost:typeof fetch=async(url,options)=>{
   approved(p,env);
   if(calls!==0||String(url)!==`https://graph.facebook.com/${c.graphVersion}/${p.phoneId}/messages`||options?.method!=='POST'||typeof options.body!=='string'||createHash('sha256').update(options.body).digest('hex')!==p.payloadSha256)throw Error('OWNER_TEST_POST_BLOCKED');
   calls++;return fetcher(url,options);
  };
  let result;
  try{result=await sendMetaPayload(p.payload,{...env,META_WHATSAPP_SENDING_ENABLED:'true'},onePost);}catch(error){
   const status=calls===0||error instanceof WhatsAppError&&['META_ACCESS_DENIED','META_RATE_LIMITED','META_SEND_REJECTED'].includes(error.code)?'REJECTED':'UNKNOWN';
   await db.query('UPDATE "WhatsAppOutboundMessage" SET status=$2,"finishedAt"=now() WHERE id=$1 AND status=\'SENDING\'',[outbound.id,status]);return {outboundId:outbound.id,status,providerPosts:calls};
  }
  await db.query('BEGIN');try{
   await db.query('UPDATE "WhatsAppOutboundMessage" SET status=\'ACCEPTED\',"providerMessageId"=$2,"finishedAt"=now() WHERE id=$1 AND status=\'SENDING\'',[outbound.id,result.providerMessageId]);
   await db.query(`INSERT INTO "WhatsAppMessage" (scope,"conversationId","providerMessageId",direction,content,status,"occurredAt") VALUES ($1,$2,$3,'OUTBOUND',$4::jsonb,'ACCEPTED',now())`,[p.scope,conv.id,result.providerMessageId,JSON.stringify({text:p.renderedText,origin:'operator_reply',purpose:'OWNER_ONLY_TRANSPORT_TEST',template:p.template.name,synthetic_booking_reference:ownerTestReference,approvalHash:packetHash(p)})]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e}
  return {outboundId:outbound.id,status:'ACCEPTED',providerPosts:calls,providerMessageId:result.providerMessageId};
 }finally{let destroy=false;try{if(lock)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock]);}catch{destroy=true;}finally{db.release(destroy);}}
}
