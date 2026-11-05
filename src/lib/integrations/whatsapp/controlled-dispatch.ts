import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {conversation,emit,sharedPool} from './shared';
import {enqueueOutbound,claimOutbound} from './outbox';
import {sendMetaPayload} from './meta-send';
import {whatsappCredentials,WhatsAppError} from './settings';
import {boundedJson} from './templates';
import {authenticate,failure} from './service-http';
import {signedHeaders,boundedBody} from './service-auth';
import {parseIntent,parseResult,stable,type IntentV2,type GatewayState,type ResultV2} from './notifications-v2-contract';
import {fullGatewayState} from './notifications-state';
import {operationalPayload,templateFingerprint,type ProviderTemplate} from './operational-adapters';
import {controlledGuard,controlledOrigin,controlledPaths,checkControlledIntent,approvalHash,digest,type ControlledResult} from './controlled-protocol';
type Dependencies={template?:()=>Promise<ProviderTemplate>;context?:(i:IntentV2,s:GatewayState)=>Promise<{decision:ResultV2;revision:string;mode:'SIMULATED'|'LIVE';scope:string}>;provider?:typeof fetch;beforeFence?:()=>Promise<void>;beforeHTTP?:()=>Promise<void>};
async function approvedTemplate(env:NodeJS.ProcessEnv):Promise<ProviderTemplate>{
 const g=controlledGuard(env);if(g.mode==='SIMULATED')return JSON.parse(await readFile(env.CONTROLLED_BC_TEMPLATE_FILE||'','utf8'));
 const c=whatsappCredentials(env),url=new URL(`https://graph.facebook.com/${c.graphVersion}/${c.wabaId}/message_templates`);url.search=new URLSearchParams({name:'nac_booking_confirmation_v1',fields:'id,name,status,category,language,parameter_format,components',limit:'25'}).toString();
 const r=await fetch(url,{headers:{Authorization:'Bearer '+c.accessToken},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('TEMPLATE_APPROVAL_UNAVAILABLE');const data=await boundedJson(r),matches=(Array.isArray(data.data)?data.data:[]).filter(t=>t.name==='nac_booking_confirmation_v1'&&t.language==='en_GB');if(matches.length!==1)throw Error('TEMPLATE_MAPPING_MISMATCH');return matches[0] as ProviderTemplate;
}
async function applicationContext(intent:IntentV2,state:GatewayState,env:NodeJS.ProcessEnv){
 const g=controlledGuard(env),origin=controlledOrigin(env.WHATSAPP_NAC_ORIGIN,g.mode),path=controlledPaths.context,body=JSON.stringify({intent,gateway_state:state});
 const r=await fetch(new URL(path,origin),{method:'POST',body,headers:{'Content-Type':'application/json',...signedHeaders('POST',path,body,env.WHATSAPP_CRM_KEY_ID||'',env.WHATSAPP_CRM_SECRET||'')},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('CANONICAL_CONTEXT_UNAVAILABLE');
 return JSON.parse(await boundedBody(r as unknown as Request)) as {decision:ResultV2;revision:string;mode:'SIMULATED'|'LIVE';scope:string};
}
/** Direct app-controlled dispatch only. Never queued for dispatchPending or a retry worker. */
export async function dispatchControlledBooking(input:unknown,pool:Pool=sharedPool(),env:NodeJS.ProcessEnv=process.env,d:Dependencies={}){
 const g=controlledGuard(env),request=input as {schema_version:string;mode:string;intent:IntentV2};if(!request||Object.keys(request).some(k=>!['schema_version','mode','intent'].includes(k))||request.schema_version!=='controlled-bc/1'||request.mode!==g.mode)throw Error('CONTROLLED_ENVELOPE_REJECTED');
 const intent=parseIntent(request.intent,g.workspace);checkControlledIntent(intent,env);
 const db=await pool.connect();let barrier:string|undefined,created=false,claimed=false,calls=0;
 const result=(status:ControlledResult['status'],reason:string,extra:Partial<ControlledResult>={}):ControlledResult=>({operation_key:intent.idempotency_key,booking_id:intent.booking_id,scope:g.scope,mode:g.mode,status,reason,provider_posts:g.mode==='LIVE'?calls:0,simulated_posts:g.mode==='SIMULATED'?calls:0,...extra});
 async function finish(r:ControlledResult){await db.query('BEGIN');try{await db.query('UPDATE "WhatsAppControlledDispatch" SET status=$3,result=$4::jsonb,provider_message_id=COALESCE(provider_message_id,$5) WHERE scope=$1 AND operation_key=$2',[g.scope,intent.idempotency_key,r.status,JSON.stringify(r),r.provider_message_id||null]);await emit(db,g.scope,'controlled:'+intent.idempotency_key+':'+r.status,'message.status',{...r,controlled_test:true});await db.query('COMMIT');return r}catch(e){await db.query('ROLLBACK');throw e}}
 try{
  const identity=(await db.query('SELECT current_database() AS name,current_user AS role')).rows[0];if(identity.name!==g.databaseIdentity.name||identity.role!==g.databaseIdentity.role)throw Error('CONTROLLED_DATABASE_MISMATCH');
  await db.query('BEGIN');let conv;try{conv=await conversation(db,g.scope,g.recipient);await db.query('COMMIT')}catch(e){await db.query('ROLLBACK');throw e}
  barrier=g.scope+':conversation:'+conv.id;await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[barrier]);
  const previous=(await db.query('SELECT * FROM "WhatsAppControlledDispatch" WHERE scope=$1 AND operation_key=$2',[g.scope,intent.idempotency_key])).rows[0];if(previous){if(previous.request_hash!==digest(request))throw Error('CONTROLLED_REQUEST_CONFLICT');return previous.result||result('UNKNOWN','OPERATION_ALREADY_STARTED_NO_RETRY')}
  // The test registration is durable even when validation blocks or the process crashes.
  await db.query('INSERT INTO "WhatsAppControlledDispatch"(scope,operation_key,request_hash,intent) VALUES($1,$2,$3,$4::jsonb)',[g.scope,intent.idempotency_key,digest(request),JSON.stringify(intent)]);created=true;
  const state=await fullGatewayState(db,g.scope,intent),template=await (d.template?d.template():approvedTemplate(env));
  if(template.name!=='nac_booking_confirmation_v1'||template.language!=='en_GB'||template.status!=='APPROVED'||template.category!=='UTILITY'||template.components.length!==1||template.components[0].type!=='BODY')return finish(result('BLOCKED','TEMPLATE_NOT_APPROVED_OR_UNSUPPORTED'));
  const context=d.context||((i,s)=>applicationContext(i,s,env));const snapshot=await context(intent,state);if(snapshot.mode!==g.mode||snapshot.scope!==g.scope||!/^\d+$/.test(snapshot.revision))throw Error('CONTROLLED_SNAPSHOT_INVALID');
  const decision=parseResult(snapshot.decision,intent,state,Date.now());if(decision.result!=='ready')return finish(result('BLOCKED',decision.reason));
  if(decision.content_mode!=='template'||intent.content.body_mappings.length!==1||intent.content.body_mappings[0].variable!=='1'||intent.content.body_mappings[0].source!=='booking_id'||intent.content.button_mappings.length)return finish(result('BLOCKED','CONTROLLED_TEMPLATE_MAPPING_REQUIRED'));
  const fingerprint=templateFingerprint(template),payload=operationalPayload(intent,decision,state,Date.now(),{template,fingerprint}),approval=approvalHash(intent,payload,fingerprint,g.deadline,g.databaseIdentity);
  if(g.mode==='LIVE'&&env.CONTROLLED_BC_APPROVAL_SHA256!==approval)return finish(result('BLOCKED','CONTROLLED_PAYLOAD_NOT_APPROVED',{approval_sha256:approval}));
  await d.beforeFence?.();
  await db.query('BEGIN');let outbound;try{
   const fence=(await db.query('SELECT fence::text FROM notification_controlled_events WHERE operation_key=$1 FOR UPDATE',[intent.idempotency_key])).rows[0];
   const current=await fullGatewayState(db,g.scope,intent);checkControlledIntent(intent,env);
   if(fence?.fence!==snapshot.revision||stable(current)!==stable(state))throw Error('CONTROLLED_SNAPSHOT_CHANGED');
   const booking=(await db.query('SELECT "cancelledAt",status FROM "Booking" WHERE provider=\'AUTOCAB\' AND "externalId"=$1',[g.booking])).rows[0];if(!booking||booking.cancelledAt||['CANCELLED','CANCELED','REJECTED','NOFARE','NOSHOW','COMPLETED'].includes(booking.status.toUpperCase()))throw Error('BOOKING_CANCELLED_OR_STALE');
   outbound=await enqueueOutbound(db,{connectionKey:g.scope,operationKey:intent.idempotency_key,actorUserId:'service:needacabplus-controlled',recipient:g.recipient,templateSnapshot:{name:template.name,language:template.language,parameters:[g.booking],body:template.components[0].text,metaId:template.id,approvalHash:approval,controlled_test:true},purpose:'SERVICE',eligibilityEvidence:{purpose:'CONTROLLED_BOOKING_CONFIRMED_TRIGGER',grantCustomerId:(await db.query('SELECT "normalCustomerId" FROM "Booking" WHERE provider=\'AUTOCAB\' AND "externalId"=$1',[g.booking])).rows[0].normalCustomerId,rule:intent.rule,approvalHash:approval}});
   if(!await claimOutbound(db,g.scope,outbound.id))throw Error('CONTROLLED_ALREADY_CLAIMED');
   await db.query('UPDATE "WhatsAppControlledDispatch" SET status=\'SENDING\' WHERE scope=$1 AND operation_key=$2',[g.scope,intent.idempotency_key]);await db.query('COMMIT');claimed=true;
  }catch(e){await db.query('ROLLBACK');throw e}
  if(g.mode==='SIMULATED'&&env.CONTROLLED_BC_SIMULATOR_FILE){const settings=JSON.parse(await readFile(env.CONTROLLED_BC_SIMULATOR_FILE,'utf8'));const delay=Math.min(5000,Math.max(0,Number(settings.before_http_delay_ms)||0));if(delay)await new Promise(r=>setTimeout(r,delay));}
  await d.beforeHTTP?.();
  const stillAuthorized=()=>{const current=checkControlledIntent(intent,env);if(current.mode!==g.mode||current.scope!==g.scope||current.deadline!==g.deadline||stable(current.databaseIdentity)!==stable(g.databaseIdentity)||(g.mode==='LIVE'&&env.CONTROLLED_BC_APPROVAL_SHA256!==approval))throw Error('CONTROLLED_PROFILE_CHANGED');};
  const onePost:typeof fetch=async(url,options)=>{
   stillAuthorized();
   // Re-read signed application context after the durable claim and immediately before HTTP.
   const current=await fullGatewayState(db,g.scope,intent),fresh=await context(intent,current),checked=parseResult(fresh.decision,intent,current,Date.now());
   if(fresh.mode!==g.mode||fresh.scope!==g.scope||fresh.revision!==snapshot.revision||checked.result!=='ready'||stable(current)!==stable(state))throw Error('CONTROLLED_FINAL_POLICY_CHANGED');
   operationalPayload(intent,checked,current,Date.now(),{template,fingerprint});
   if(calls!==0||String(url)!==`https://graph.facebook.com/${env.META_WHATSAPP_GRAPH_VERSION||'v25.0'}/${env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`||options?.method!=='POST'||options.body!==JSON.stringify(payload))throw Error('CONTROLLED_POST_BLOCKED');
   stillAuthorized();calls++;
   if(g.mode==='SIMULATED'){
    if(d.provider)return d.provider(url,options);
    const settings=env.CONTROLLED_BC_SIMULATOR_FILE?JSON.parse(await readFile(env.CONTROLLED_BC_SIMULATOR_FILE,'utf8')):{};
    const delay=Math.min(2000,Math.max(0,Number(settings.provider_delay_ms)||0));if(delay)await new Promise(r=>setTimeout(r,delay));
    if(settings.outcome==='timeout')throw Error('SIMULATED_TIMEOUT');if(settings.outcome==='rejected')return Response.json({error:{code:131026}},{status:400});if(settings.outcome==='server-error')return Response.json({},{status:500});if(settings.outcome==='malformed')return Response.json({});
    return Response.json({messages:[{id:'simulated:'+randomUUID()}]});
   }
   return (d.provider||fetch)(url,options);
  };
  const transportEnv=g.mode==='SIMULATED'?{...env,META_WHATSAPP_ENABLED:'true',META_WHATSAPP_APP_ID:'99999999997',META_WHATSAPP_GRAPH_VERSION:env.META_WHATSAPP_GRAPH_VERSION||'v25.0',META_WHATSAPP_ACCESS_TOKEN:'synthetic-controlled-transport-not-a-real-token'}:env;
  let receipt;try{receipt=await sendMetaPayload(payload,{...transportEnv,META_WHATSAPP_SENDING_ENABLED:'true'},onePost)}catch(e){const status=calls===0||e instanceof WhatsAppError&&['META_ACCESS_DENIED','META_RATE_LIMITED','META_SEND_REJECTED'].includes(e.code)?'REJECTED':'UNKNOWN';await db.query('UPDATE "WhatsAppOutboundMessage" SET status=$2,"finishedAt"=now() WHERE id=$1 AND status=\'SENDING\'',[outbound.id,status]);return finish(result(status,calls?'PROVIDER_OUTCOME_'+status:'FINAL_POLICY_BLOCKED_NO_POST',{outbound_id:outbound.id,approval_sha256:approval}))}
  const r=result('ACCEPTED','PROVIDER_ACCEPTED_NOT_DELIVERED',{provider_message_id:receipt.providerMessageId,outbound_id:outbound.id,approval_sha256:approval});
  await db.query('BEGIN');try{
   await db.query('UPDATE "WhatsAppOutboundMessage" SET status=\'ACCEPTED\',"providerMessageId"=$2,"finishedAt"=now() WHERE id=$1',[outbound.id,receipt.providerMessageId]);
   await db.query(`INSERT INTO "WhatsAppMessage"(scope,"conversationId","providerMessageId",direction,content,status,"occurredAt") VALUES($1,$2,$3,'OUTBOUND',$4::jsonb,$5,now())`,[g.scope,conv.id,receipt.providerMessageId,JSON.stringify({text:decision.rendered_text,origin:'operational_notification',controlled_test:true,booking_id:intent.booking_id,operation_key:intent.idempotency_key,mode:g.mode,approval_sha256:approval,payload}),g.mode==='SIMULATED'?'SIMULATED':'ACCEPTED']);
   await db.query('UPDATE "WhatsAppControlledDispatch" SET status=\'ACCEPTED\',result=$3::jsonb,provider_message_id=$4 WHERE scope=$1 AND operation_key=$2',[g.scope,intent.idempotency_key,JSON.stringify(r),receipt.providerMessageId]);
   await emit(db,g.scope,'controlled:'+intent.idempotency_key+':ACCEPTED','message.accepted',{...r,controlled_test:true,conversation_id:conv.id});await db.query('COMMIT');return r;
  }catch(e){await db.query('ROLLBACK');throw e}
 }catch(e){if(!created)throw e;const allowed=['CONTROLLED_SNAPSHOT_CHANGED','CONTROLLED_APPROVAL_EXPIRED','CONTROLLED_INTENT_REJECTED','BOOKING_CANCELLED_OR_STALE','CONTROLLED_ALREADY_CLAIMED','TEMPLATE_MAPPING_MISMATCH','CANONICAL_CONTEXT_UNAVAILABLE'];const reason=e instanceof Error&&allowed.includes(e.message)?e.message:claimed?'PERSISTENCE_OR_SEND_OUTCOME_UNKNOWN':'CONTROLLED_VALIDATION_UNAVAILABLE';return finish(result(claimed?'UNKNOWN':'BLOCKED',reason));
 }finally{let destroy=false;try{if(barrier)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[barrier])}catch{destroy=true}finally{db.release(destroy)}}
}
export async function controlledDispatchPOST(request:Request){try{controlledGuard();const {body}=await authenticate(request);return Response.json(await dispatchControlledBooking(JSON.parse(body)),{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
