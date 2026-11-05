import {dispatchOperationalSimulation} from './dispatch';
import {windowOpen,templateFingerprint,type ProviderTemplate,type SimulatedOutcome} from './operational-adapters';
import {readFile} from 'node:fs/promises';
import {hash} from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {authenticate,failure} from './service-http';
import {sharedPool,stable,emit,handoff} from './shared';
import {fullStageGuard} from './notifications-full-stage-guard';
import {parseIntent,parseResult,type IntentV2,type GatewayState,type ResultV2} from './notifications-v2-contract';
import {readNacContext} from './notifications-v2-http';
export {fullGatewayState} from './notifications-state';
import {fullGatewayState} from './notifications-state';

async function readStageContext(intent:IntentV2,state:GatewayState){
 const target=new URL(process.env.NOTIFICATIONS_NAC_ORIGIN||'');
 if(process.env.NOTIFICATIONS_STAGE_LOCAL_TEST==='true'&&target.hostname==='127.0.0.1'&&target.protocol==='http:'){
  const actual=target.origin;target.protocol='https:';
  return readNacContext(target.origin,intent,state,process.env.WHATSAPP_CRM_KEY_ID||'',process.env.WHATSAPP_CRM_SECRET||'',((url,init)=>fetch(new URL(new URL(String(url)).pathname,actual),init)) as typeof fetch);
 }
 return readNacContext(target.origin,intent,state,process.env.WHATSAPP_CRM_KEY_ID||'',process.env.WHATSAPP_CRM_SECRET||'',fetch);
}
type Dependencies={context?:(i:IntentV2,s:GatewayState)=>Promise<unknown>;beforeCommit?:()=>Promise<void>};
/** Staging-only adapter to the single gateway; invokes only its guarded simulation entrypoint. */
export async function simulateFullDelivery(pool:Pool,scope:string,input:unknown,dependencies:Dependencies={}){
 const {workspace}=fullStageGuard(),intent=parseIntent(input,workspace),db=await pool.connect();let barrier:string|undefined;
 try{
  const conv=(await db.query('SELECT id FROM "WhatsAppConversation" WHERE scope=$1 AND participant=$2',[scope,intent.recipient])).rows[0];if(!conv)throw Error('STAGE_CONVERSATION_MISSING');barrier=scope+':conversation:'+conv.id;
  // Same session advisory barrier as production dispatchIntent; handoff uses the same xact key.
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[barrier]);
  const old=(await db.query('SELECT result FROM notification_stage_delivery WHERE scope=$1 AND operation_key=$2',[scope,intent.idempotency_key])).rows[0];if(old)return old.result as ResultV2;
  const state=await fullGatewayState(db,scope,intent);
  let envelope:{decision:unknown;revision:string};let result:ResultV2;let contextFailed=false;
  try{
   const raw=await (dependencies.context?dependencies.context(intent,state):readStageContext(intent,state));
   envelope=raw as {decision:unknown;revision:string};if(!/^\d+$/.test(envelope.revision))throw Error('INVALID_STAGE_REVISION');
   result=parseResult(envelope.decision,intent,state,Date.now());
  }catch{
   contextFailed=true;envelope={decision:null,revision:'0'};
   result={schema_version:'2.0',mode:'DRY_RUN',idempotency_key:intent.idempotency_key,booking_id:intent.booking_id,rule:intent.rule,conversation_id:state.conversation_id,conversation_revision:state.conversation_revision,checked_at:new Date().toISOString(),result:'blocked',reason:'CONTEXT_VALIDATION_UNAVAILABLE',channel:'none',provider_status:'NONE',provider_called:false};
  }
  // A visible staging-only phase marker enables deterministic real-HTTP concurrency tests.
  await db.query("INSERT INTO notification_stage_control(key,value) VALUES('initial_content_mode',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[JSON.stringify(result.content_mode||null)]);
  await db.query(`UPDATE notification_stage_control SET value='"SIMULATION_PENDING"' WHERE key='phase'`);
  const delay=Number((await db.query("SELECT value FROM notification_stage_control WHERE key='delay_ms'")).rows[0].value);if(delay>0)await db.query('SELECT pg_sleep($1)',[Math.min(delay,5000)/1000]);
  await dependencies.beforeCommit?.();
  // Time alone can close the window without changing any database revision.
  // Ask the canonical rule engine again; never serialize stale free text as a template.
  if(!contextFailed&&result.result==='ready'&&result.content_mode==='text'&&!windowOpen(state,Date.now())){
   try{const fresh=await fullGatewayState(db,scope,intent);envelope=await (dependencies.context?dependencies.context(intent,fresh):readStageContext(intent,fresh)) as typeof envelope;
    if(!/^\d+$/.test(envelope.revision))throw Error('INVALID_STAGE_REVISION');result=parseResult(envelope.decision,intent,fresh,Date.now());
   }catch{contextFailed=true}
  }
  await db.query('BEGIN');try{
   const marker=(await db.query('SELECT revision::text FROM notification_stage_marker WHERE id=true FOR UPDATE')).rows[0].revision;
   const current=await fullGatewayState(db,scope,intent),booking=(await db.query('SELECT * FROM "Booking" WHERE "externalId"=$1',[intent.booking_id.slice(8)])).rows[0];
   const block=(reason:string):ResultV2=>({schema_version:'2.0',mode:'DRY_RUN',idempotency_key:intent.idempotency_key,booking_id:intent.booking_id,rule:intent.rule,conversation_id:current.conversation_id,conversation_revision:current.conversation_revision,checked_at:new Date().toISOString(),result:'blocked',reason,channel:'none',provider_status:'NONE',provider_called:false});
   if(booking?.cancelledAt)result=block('BOOKING_CANCELLED');
   else if(current.operator)result=block('OPERATOR_TAKEOVER');
   else if(current.suppressed)result=block('RECIPIENT_SUPPRESSED');
   else if(contextFailed)result=block('CONTEXT_VALIDATION_UNAVAILABLE');
   else if(marker!==envelope.revision||stable(state)!==stable(current))result=block('CANONICAL_SNAPSHOT_CHANGED');
   else if(Date.parse(intent.expires_at)<=Date.now())result=block('NOTIFICATION_EXPIRED');
   let simulation:SimulatedOutcome|undefined;
   if(result.result==='ready'){
    try{
     let approved:{template:ProviderTemplate;fingerprint:string}|undefined;
     if(result.content_mode==='template'){
      const t=(await db.query('SELECT definition FROM notification_stage_template WHERE id=$1',[intent.content.template.id])).rows[0]?.definition;
      if(!t||t.fingerprint!==intent.content.template.fingerprint||t.text===undefined)throw Error('TEMPLATE_MAPPING_MISMATCH');
      if((t.hasHeader||t.buttons.length)&&!t.providerTemplate)throw Error('UNSUPPORTED_TEMPLATE_COMPONENTS');
      const template:ProviderTemplate=t.providerTemplate||{id:t.id,name:t.name,language:t.language,status:t.status,category:t.category,parameter_format:t.format,components:[{type:'BODY',text:t.text}]};
      if(template.status!==t.status||template.category!==t.category||template.parameter_format!==t.format)throw Error('TEMPLATE_MAPPING_MISMATCH');
      approved={template,fingerprint:t.providerTemplate?t.providerFingerprint:templateFingerprint(template)};
     }
     simulation=await dispatchOperationalSimulation([intent,result,current,Date.now(),approved]);
    }catch(e){const code=e instanceof Error?e.message:'';result=block(['WHATSAPP_WINDOW_CLOSING','TEMPLATE_MAPPING_MISMATCH','TEMPLATE_NOT_APPROVED','TEMPLATE_RENDER_MISMATCH','HEADER_ADAPTER_UNAVAILABLE','UNSUPPORTED_TEMPLATE_COMPONENTS','BUTTON_BEHAVIOUR_NOT_IMPLEMENTED','NOTIFICATION_EXPIRED'].includes(code)?code:'PAYLOAD_ADAPTER_BLOCKED')}
   }
   await db.query('INSERT INTO notification_stage_delivery(scope,operation_key,result,conversation_id) VALUES($1,$2,$3::jsonb,$4)',[scope,intent.idempotency_key,JSON.stringify(result),conv.id]);
   if(result.result==='ready'&&simulation){
    // SIMULATED is intentionally not ACCEPTED/DELIVERED. No provider receipt is fabricated.
    await db.query(`INSERT INTO "WhatsAppMessage"(scope,"conversationId","providerMessageId",direction,content,status,"occurredAt") VALUES($1,$2,$3,'OUTBOUND',$4::jsonb,'SIMULATED',now())`,[scope,conv.id,simulation.providerMessageId||'simulated:'+randomUUID(),JSON.stringify({provider_payload:simulation.payload,simulated_provider_status:simulation.status,text:result.rendered_text,origin:'operational_notification',transport:'SIMULATED',booking_id:intent.booking_id.slice(8),event_type:intent.event_type,rule:result.rule,channel:result.channel,content_mode:result.content_mode,synthetic:true})]);
   }
   await emit(db,scope,'stage:'+intent.idempotency_key,'notification.simulated',{booking_id:intent.booking_id.slice(8),origin:'operational_notification',mode:'DRY_RUN',result});
   // This is shared local audit history, never a callback queued for a production consumer.
   await db.query('UPDATE "WhatsAppSharedEvent" SET "deliveredAt"=now() WHERE scope=$1 AND "eventKey"=$2',[scope,'stage:'+intent.idempotency_key]);
   await db.query(`UPDATE notification_stage_control SET value='"COMMITTED"' WHERE key='phase'`);await db.query('COMMIT');return result;
  }catch(e){await db.query('ROLLBACK');throw e}
 }finally{if(barrier)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[barrier]);db.release()}
}
export async function fullPreviewPOST(request:Request){try{fullStageGuard();const {body,scope}=await authenticate(request);return Response.json(await simulateFullDelivery(sharedPool(),scope,JSON.parse(body)),{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
export async function fullControlPOST(request:Request){try{
 fullStageGuard();const {body,scope}=await authenticate(request),input=JSON.parse(body),pool=sharedPool();
 if(input.action==='bootstrap-operator'){
  const email=process.env.ADMIN_EMAIL||'',password=process.env.ADMIN_PASSWORD||'';
  if(!email.endsWith('@notifications.invalid')||password.length<24)throw Error('INVALID_SYNTHETIC_OPERATOR');
  const db=await pool.connect();try{await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtextextended('notification-stage-operator',0))");
   const present=(await db.query("SELECT to_regclass('\"User\"') AS ready")).rows[0].ready;
   if(!present)await db.query(await readFile(process.cwd()+'/staging/notifications-operator.sql','utf8'));
   await db.query(`INSERT INTO "User"(id,name,email,"passwordHash",role,"isActive","mustChangePassword","updatedAt") VALUES('SYNTHETIC-OPERATOR','Demo Operator',$1,$2,'ADMIN',true,false,now()) ON CONFLICT(id) DO UPDATE SET "passwordHash"=excluded."passwordHash","updatedAt"=now()`,[email,await hash(password,12)]);
   await db.query('COMMIT');return Response.json({operator:'SYNTHETIC-OPERATOR',authentication:'existing NextAuth credentials and RBAC',mode:'DRY_RUN'});
  }catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}
 }
 if(input.action==='handoff'){
  if(!['AUTOMATED','OPERATOR'].includes(input.mode))throw Error('INVALID_STAGE_MODE');const db=await pool.connect();try{await db.query('BEGIN');const row=(await db.query('SELECT revision FROM "WhatsAppConversation" WHERE id=\'SYNTHETIC-CONVERSATION\' AND scope=$1',[scope])).rows[0];if(!row)throw Error('NOT_FOUND');const result=await handoff(db,scope,'SYNTHETIC-CONVERSATION',{id:randomUUID(),mode:input.mode,revision:row.revision},'staging-operator');
   if(input.delay_ms){await pool.query(`UPDATE notification_stage_control SET value='"HANDOFF_LOCKED"' WHERE key='phase'`);await db.query('SELECT pg_sleep($1)',[Math.min(1500,Math.max(0,Number(input.delay_ms)))/1000])}
   const applied=(await db.query('SELECT clock_timestamp() AS at')).rows[0].at;await db.query('COMMIT');return Response.json({...result,applied_at:new Date(applied).toISOString()});
  }catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}
 }
 if(input.action==='delay'){const delay=Number(input.ms);if(!Number.isFinite(delay)||delay<0||delay>5000)throw Error('INVALID_STAGE_DELAY');await pool.query("UPDATE notification_stage_control SET value=$1::jsonb WHERE key='delay_ms'",[JSON.stringify(delay)]);await pool.query(`UPDATE notification_stage_control SET value='"IDLE"' WHERE key='phase'`);return Response.json({delay_ms:delay})}
 if(input.action==='locks')return Response.json({waiting:Number((await pool.query("SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'")).rows[0].n)});
 if(input.action==='phase')return Response.json((await pool.query("SELECT (SELECT value FROM notification_stage_control WHERE key='phase') AS phase,(SELECT value FROM notification_stage_control WHERE key='initial_content_mode') AS content_mode")).rows[0]);
 throw Error('INVALID_STAGE_ACTION');
 }catch(e){return failure(e)}}
