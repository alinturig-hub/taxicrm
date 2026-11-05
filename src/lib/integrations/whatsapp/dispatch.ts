import type {Pool,PoolClient} from 'pg';
import {sharedPool,sharedScope,emit,validateIntent} from './shared';
import {journeyEvidence,journeyParameters,normalizeJourneyPhone,type JourneyBooking} from './journey';
import {approvedServiceTemplate} from './approved-template';
import {enqueueOutbound,claimOutbound} from './outbox';
import {sendMetaTemplate} from './meta-send';
import {WhatsAppError} from './settings';
export function dispatchEnabled(env:NodeJS.ProcessEnv=process.env){return env.WHATSAPP_SHARED_ENABLED==='true'&&env.WHATSAPP_JOURNEY_SENDING_ENABLED==='true'&&env.META_WHATSAPP_SENDING_ENABLED==='true';}
export async function authoritativeBooking(db:PoolClient,bookingId:string){if(!/^autocab:[a-zA-Z0-9_-]{1,100}$/.test(bookingId))throw Error('UNSUPPORTED_BOOKING_PROVIDER');return (await db.query<JourneyBooking>(`SELECT "externalId","normalCustomerId",status,"telephoneNumber","bookedAtTime","acceptedAt","arrivedAt","pickedUpAt","completedAt","cancelledAt","driverId","vehicleId","driverForename","vehicleRegistration","pickupDueTime" FROM "Booking" WHERE provider='AUTOCAB' AND "externalId"=$1`,[bookingId.slice(8)])).rows[0];}
async function policy(db:PoolClient,scope:string,id:string){
 const row=(await db.query(`SELECT i.*,c.mode,c.revision AS "conversationRevision" FROM "WhatsAppServiceIntent" i JOIN "WhatsAppConversation" c ON c.id=i."conversationId" AND c.scope=i.scope WHERE i.scope=$1 AND i.id=$2`,[scope,id])).rows[0];
 if(!row||row.status!=='HELD')return null;
 if(row.mode!=='AUTOMATED'){await db.query(`UPDATE "WhatsAppServiceIntent" SET status='CANCELLED',"lastReason"='OPERATOR_TAKEOVER' WHERE id=$1`,[id]);return null;}
 if(new Date(row.expiresAt).getTime()<=Date.now()){await db.query(`UPDATE "WhatsAppServiceIntent" SET status='EXPIRED' WHERE id=$1`,[id]);return null;}
 const v=validateIntent(row.payload),booking=await authoritativeBooking(db,v.booking_id);
 if(!booking||!booking.telephoneNumber||normalizeJourneyPhone(booking.telephoneNumber)!==v.recipient)throw Error('BOOKING_RECIPIENT_MISMATCH');
 const evidence=journeyEvidence(booking,v.event_type);
 if(!evidence||evidence.revision!==v.revision||evidence.expiresAt<=Date.now())throw Error('STALE_BOOKING_EVENT');
 const grant=(await db.query(`SELECT * FROM "WhatsAppRecipientGrant" WHERE scope=$1 AND recipient=$2`,[scope,v.recipient])).rows[0];
 if(!grant||!booking.normalCustomerId||grant.customerId!==booking.normalCustomerId||!grant.serviceAllowed||grant.suppressed||new Date(grant.verifiedAt).getTime()>Date.now()||new Date(grant.validUntil).getTime()<=Date.now())throw Error('RECIPIENT_NOT_ELIGIBLE');
 const binding=(await db.query(`SELECT * FROM "WhatsAppTemplateBinding" WHERE scope=$1 AND milestone=$2 AND enabled=true`,[scope,v.event_type])).rows[0];if(!binding)throw Error('TEMPLATE_BINDING_REQUIRED');
 if(!Array.isArray(binding.parameterKeys)||binding.parameterKeys.some((x:unknown)=>typeof x!=='string'))throw Error('INVALID_TEMPLATE_BINDING');
 return {row,v,booking,binding,grant,parameters:journeyParameters(booking,binding.parameterKeys)};
}
/** Session advisory barrier spans the durably committed claim and bounded provider HTTP.
 * Handoff uses the same key with an xact lock; it acknowledges only after an in-flight dispatch finishes.
 * No transaction stays open across a Meta call. A process crash releases the lock, not the durable claim. */
export async function dispatchIntent(id:string,scope:string,db:PoolClient,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 if(!dispatchEnabled(env))return 'DISABLED';
 const row=(await db.query(`SELECT "conversationId" FROM "WhatsAppServiceIntent" WHERE scope=$1 AND id=$2`,[scope,id])).rows[0];if(!row)return 'MISSING';
 const barrier=scope+':conversation:'+row.conversationId;await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[barrier]);
 try{
 const p=await policy(db,scope,id);if(!p)return 'SKIPPED';
 const template=await approvedServiceTemplate(p.binding.name,p.binding.language,p.parameters.length,env,fetcher);
 // Booking, grant and binding may have changed while Meta approval was being read.
 const current=await policy(db,scope,id);if(!current)return 'SKIPPED';
 if(current.binding.name!==p.binding.name||current.binding.language!==p.binding.language||JSON.stringify(current.parameters)!==JSON.stringify(p.parameters))throw Error('POLICY_CHANGED');
 const snapshot={name:template.name,language:template.language,parameters:current.parameters,body:template.body,metaId:template.metaId};
 let outbound:Awaited<ReturnType<typeof enqueueOutbound>>;
 await db.query('BEGIN');try{
 // Lock intent before enqueue/claim. The conversation barrier has already excluded handoff.
 const locked=(await db.query(`SELECT status FROM "WhatsAppServiceIntent" WHERE scope=$1 AND id=$2 FOR UPDATE`,[scope,id])).rows[0];if(locked?.status!=='HELD'){await db.query('ROLLBACK');return 'SKIPPED';}
 const bindingLock=(await db.query(`SELECT name,language,enabled,"parameterKeys" FROM "WhatsAppTemplateBinding" WHERE scope=$1 AND milestone=$2 FOR SHARE`,[scope,current.v.event_type])).rows[0];
 if(!bindingLock?.enabled||bindingLock.name!==template.name||bindingLock.language!==template.language||JSON.stringify(bindingLock.parameterKeys)!==JSON.stringify(current.binding.parameterKeys))throw Error('POLICY_CHANGED');
 outbound=await enqueueOutbound(db,{connectionKey:scope,operationKey:current.v.idempotency_key,actorUserId:'service:needacabplus',recipient:current.v.recipient,templateSnapshot:snapshot,purpose:'SERVICE',eligibilityEvidence:{grantCustomerId:current.grant.customerId,proofReference:current.grant.proofReference,bookingId:current.v.booking_id,revision:current.v.revision,conversationRevision:current.row.conversationRevision}});
 const claimed=await claimOutbound(db,scope,outbound.id);if(!claimed){await db.query(`UPDATE "WhatsAppServiceIntent" SET status=$2,"outboundId"=$3 WHERE id=$1`,[id,['ACCEPTED','REJECTED'].includes(outbound.status)?outbound.status:'UNKNOWN',outbound.id]);await db.query('COMMIT');return 'REUSED';}
 await db.query(`UPDATE "WhatsAppServiceIntent" SET status='SENDING',"outboundId"=$2,"claimedAt"=now(),"lastReason"=NULL WHERE id=$1`,[id,outbound.id]);await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}
 let outcome:Awaited<ReturnType<typeof sendMetaTemplate>>;
 try{outcome=await sendMetaTemplate({recipient:current.v.recipient,name:template.name,language:template.language,parameters:current.parameters},env,fetcher);}catch(e){
 const status=e instanceof WhatsAppError&&['META_ACCESS_DENIED','META_RATE_LIMITED','META_SEND_REJECTED','INVALID_TEMPLATE_SEND'].includes(e.code)?'REJECTED':'UNKNOWN';
 await db.query(`UPDATE "WhatsAppOutboundMessage" SET status=$2,"finishedAt"=now() WHERE id=$1 AND status='SENDING'`,[outbound.id,status]);await db.query(`UPDATE "WhatsAppServiceIntent" SET status=$2,"lastReason"=$3 WHERE id=$1 AND status='SENDING'`,[id,status,e instanceof WhatsAppError?e.code:'SEND_OUTCOME_UNKNOWN']);return status;
 }
 // Atomic accepted status + history + fanout; on persistence failure the claim remains SENDING.
 await db.query('BEGIN');try{
 await db.query(`UPDATE "WhatsAppOutboundMessage" SET status='ACCEPTED',"providerMessageId"=$2,"finishedAt"=now() WHERE id=$1`,[outbound.id,outcome.providerMessageId]);
 await db.query(`UPDATE "WhatsAppServiceIntent" SET status='ACCEPTED' WHERE id=$1`,[id]);
 await db.query(`INSERT INTO "WhatsAppMessage" (scope,"conversationId","providerMessageId",direction,content,status,"occurredAt") VALUES ($1,$2,$3,'OUTBOUND',$4::jsonb,'ACCEPTED',now()) ON CONFLICT(scope,"providerMessageId") DO UPDATE SET content=EXCLUDED.content`,[scope,row.conversationId,outcome.providerMessageId,JSON.stringify({...snapshot,text:template.body.replace(/\{\{([1-9]\d*)\}\}/g,(_,i)=>current.parameters[Number(i)-1]),origin:'journey',intent_id:id})]);
 await emit(db,scope,'intent:'+id+':ACCEPTED','message.accepted',{intent_id:id,conversation_id:row.conversationId,provider_message_id:outcome.providerMessageId,status:'ACCEPTED'});await db.query('COMMIT');return 'ACCEPTED';
 }catch(e){await db.query('ROLLBACK');throw e;}
 }catch(e){const allowed=['BOOKING_RECIPIENT_MISMATCH','STALE_BOOKING_EVENT','RECIPIENT_NOT_ELIGIBLE','TEMPLATE_BINDING_REQUIRED','APPROVED_TEMPLATE_REQUIRED','APPROVED_UTILITY_TEMPLATE_REQUIRED','UNSUPPORTED_TEMPLATE_COMPONENTS','TEMPLATE_PARAMETERS_MISMATCH','PARAMETERS_UNAVAILABLE','POLICY_CHANGED','TEMPLATE_APPROVAL_UNAVAILABLE'];const reason=e instanceof Error&&allowed.includes(e.message)?e.message:'DISPATCH_UNAVAILABLE';await db.query(`UPDATE "WhatsAppServiceIntent" SET "lastReason"=$2,attempts=attempts+1,"nextAttemptAt"=now()+interval '1 minute' * LEAST(15,POWER(2,LEAST(attempts,4))) WHERE id=$1 AND status='HELD'`,[id,reason]);return reason;
 }finally{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[barrier]);}
}
export async function dispatchPending(pool:Pool=sharedPool(),env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 if(!dispatchEnabled(env))return {enabled:false,processed:0};const scope=sharedScope(env);
 // Never replay claims after a crash; webhook reconciliation can later enrich their delivery facts.
 await pool.query(`UPDATE "WhatsAppOutboundMessage" SET status='UNKNOWN',"finishedAt"=now() WHERE "connectionKey"=$1 AND status='SENDING' AND "claimedAt"<now()-interval '5 minutes'`,[scope]);
 await pool.query(`UPDATE "WhatsAppServiceIntent" SET status='UNKNOWN',"lastReason"='STALE_CLAIM' WHERE scope=$1 AND status='SENDING' AND "claimedAt"<now()-interval '5 minutes'`,[scope]);
 const rows=(await pool.query(`SELECT id FROM "WhatsAppServiceIntent" WHERE scope=$1 AND status='HELD' AND "expiresAt">now() AND "nextAttemptAt"<=now() ORDER BY "nextAttemptAt","createdAt",id LIMIT 10`,[scope])).rows;let processed=0;
 let index=0;const run=async()=>{for(;;){const r=rows[index++];if(!r)return;const db=await pool.connect();try{await dispatchIntent(r.id,scope,db,env,fetcher);processed++;}finally{db.release();}}};await Promise.all([run(),run()]);return {enabled:true,processed};
}

/** v2 is integrated into this single sender module for simulation only; no live v2 entrypoint. */
export async function dispatchOperationalSimulation(input:Parameters<typeof import('./operational-adapters').operationalPayload>,env:NodeJS.ProcessEnv=process.env,scenario:Parameters<typeof import('./operational-adapters').simulateProvider>[1]='accepted'){
 if(env.STAGING_NO_SEND!=='true'||env.META_WHATSAPP_SENDING_ENABLED==='true'||env.WHATSAPP_JOURNEY_SENDING_ENABLED==='true')throw Error('OPERATIONAL_SIMULATION_ONLY');
 const {operationalPayload,simulateProvider}=await import('./operational-adapters');
 return simulateProvider(operationalPayload(...input),scenario);
}

// Direct allowlisted trial only, separate from the general retry worker.
export {dispatchControlledBooking} from './controlled-dispatch';
