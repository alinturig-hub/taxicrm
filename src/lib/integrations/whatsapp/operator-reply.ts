import type {Pool,PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {sharedPool,sharedScope,emit} from './shared';
import {enqueueOutbound,claimOutbound} from './outbox';
import {sendMetaPayload} from './meta-send';
import {WhatsAppError} from './settings';
import {ownerTestGuard} from './operator-owner-test';
const idPattern=/^[a-zA-Z0-9_-]{16,100}$/;
export type ReplyCommand={command_id:string;revision:number;text:string};
export function parseReply(value:unknown):ReplyCommand{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_COMMAND');const x=value as Record<string,unknown>;
 if(Object.keys(x).sort().join(',')!=='command_id,revision,text'||typeof x.command_id!=='string'||!idPattern.test(x.command_id)||!Number.isSafeInteger(x.revision)||Number(x.revision)<0||typeof x.text!=='string'||!x.text.trim()||x.text.length>4096||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(x.text))throw Error('INVALID_COMMAND');
 return x as ReplyCommand;
}
async function lock(db:PoolClient,scope:string,id:string){await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope+':conversation:'+id]);const c=(await db.query(`SELECT id,participant,mode,revision FROM "WhatsAppConversation" WHERE scope=$1 AND id=$2 FOR UPDATE`,[scope,id])).rows[0];if(!c)throw Error('NOT_FOUND');return c;}
async function windowDeadline(db:PoolClient,scope:string,id:string){const r=await db.query(`SELECT max("occurredAt") AS at FROM "WhatsAppMessage" WHERE scope=$1 AND "conversationId"=$2 AND direction='INBOUND' AND status='RECEIVED' AND "occurredAt"<=now()`,[scope,id]);const at=r.rows[0]?.at?new Date(r.rows[0].at).getTime():NaN;if(!Number.isFinite(at)||at+86400000-Date.now()<=8000)throw Error('WHATSAPP_WINDOW_CLOSING');return at+86400000;}
async function policy(db:PoolClient,scope:string,c:{id:string;participant:string;mode:string;revision:number},revision:number){
 if(c.mode!=='OPERATOR'||c.revision!==revision)throw Error('REVISION_CONFLICT');
 if(!/^\+[1-9]\d{7,14}$/.test(c.participant))throw Error('RECIPIENT_PHONE_UNAVAILABLE');
 const grant=(await db.query(`SELECT suppressed FROM "WhatsAppRecipientGrant" WHERE scope=$1 AND recipient=$2`,[scope,c.participant])).rows[0];if(grant?.suppressed)throw Error('RECIPIENT_SUPPRESSED');
 if(!grant){const stop=(await db.query(`SELECT 1 FROM "WhatsAppMessage" WHERE scope=$1 AND "conversationId"=$2 AND direction='INBOUND' AND upper(trim(content->>'text')) IN ('STOP','UNSUBSCRIBE','STOP ALL') LIMIT 1`,[scope,c.id])).rowCount;if(stop)throw Error('RECIPIENT_SUPPRESSED');}
 return windowDeadline(db,scope,c.id);
}
/** One durable claim per command; uncertain/unfinished attempts block new replies to this conversation. */
export async function operatorReply(id:string,input:unknown,opts:{pool?:Pool;scope?:string;env?:NodeJS.ProcessEnv;fetcher?:typeof fetch}={}){
 const command=parseReply(input),env=opts.env||process.env;
 if(env.WHATSAPP_OPERATOR_REPLY_ENABLED!=='true'||env.META_WHATSAPP_SENDING_ENABLED!=='true')throw Error('OPERATOR_REPLY_DISABLED');
 const scope=opts.scope||sharedScope(env),pool=opts.pool||sharedPool(),db=await pool.connect();let claimedId='';
 try{
  await db.query('BEGIN');let c=await lock(db,scope,id);const test=ownerTestGuard(env,c.participant,'reply');if(test&&createHash('sha256').update(command.text).digest('hex')!==test.approvedBodySha256)throw Error('OWNER_TEST_BODY_MISMATCH');const operationKey=test?.operationKey||command.command_id;const snapshot={origin:'operator_reply',conversationId:id,text:command.text};
  const existing=(await db.query(`SELECT id FROM "WhatsAppOutboundMessage" WHERE "connectionKey"=$1 AND "operationKey"=$2`,[scope,operationKey])).rows[0];
  if(!existing){await policy(db,scope,c,command.revision);const unresolved=(await db.query(`SELECT id FROM "WhatsAppOutboundMessage" WHERE "connectionKey"=$1 AND "templateSnapshot"->>'origin'='operator_reply' AND "templateSnapshot"->>'conversationId'=$2 AND status IN ('SENDING','UNKNOWN') LIMIT 1`,[scope,id])).rows[0];if(unresolved)throw Error('PREVIOUS_REPLY_UNRESOLVED');}
  const row=await enqueueOutbound(db,{connectionKey:scope,operationKey,actorUserId:'service:needacabplus-admin',recipient:c.participant,templateSnapshot:snapshot,purpose:'SERVICE',eligibilityEvidence:{mode:'MANUAL_REPLY'}});
  const claimed=await claimOutbound(db,scope,row.id);if(!claimed){await db.query('COMMIT');return {id:row.id,status:row.status,reused:true};}
  claimedId=row.id;await db.query('COMMIT');
  await db.query('BEGIN');c=await lock(db,scope,id);let deadline:number;
  try{const test=ownerTestGuard(env,c.participant,'reply');if(test&&createHash('sha256').update(command.text).digest('hex')!==test.approvedBodySha256)throw Error('OWNER_TEST_BODY_MISMATCH');deadline=await policy(db,scope,c,command.revision)}catch(e){await db.query(`UPDATE "WhatsAppOutboundMessage" SET status='CANCELLED',"finishedAt"=now() WHERE "connectionKey"=$1 AND id=$2 AND status='SENDING'`,[scope,claimedId]);await db.query('COMMIT');return {id:claimedId,status:'CANCELLED',reason:e instanceof Error?e.message:'POLICY_CHANGED',reused:false};}
  let outcome:{providerMessageId:string;status:'ACCEPTED'};
  try{outcome=await sendMetaPayload({messaging_product:'whatsapp',to:c.participant.slice(1),type:'text',text:{preview_url:false,body:command.text}},env,opts.fetcher,{textWindowExpiresAt:deadline});}
  catch(e){const code=e instanceof WhatsAppError?e.code:'';const status=['META_ACCESS_DENIED','META_RATE_LIMITED','META_SEND_REJECTED'].includes(code)?'REJECTED':code==='WHATSAPP_WINDOW_CLOSING'?'CANCELLED':'UNKNOWN';await db.query(`UPDATE "WhatsAppOutboundMessage" SET status=$3,"finishedAt"=now() WHERE "connectionKey"=$1 AND id=$2 AND status='SENDING'`,[scope,claimedId,status]);await db.query('COMMIT');return {id:claimedId,status,reused:false};}
  await db.query(`UPDATE "WhatsAppOutboundMessage" SET status='ACCEPTED',"providerMessageId"=$3,"finishedAt"=now() WHERE "connectionKey"=$1 AND id=$2 AND status='SENDING'`,[scope,claimedId,outcome.providerMessageId]);
  await db.query(`INSERT INTO "WhatsAppMessage" (scope,"conversationId","providerMessageId",direction,content,status,"occurredAt") VALUES ($1,$2,$3,'OUTBOUND',$4::jsonb,'ACCEPTED',now())`,[scope,id,outcome.providerMessageId,JSON.stringify({origin:'operator_reply',text:command.text,type:'text'})]);
  await emit(db,scope,'operator:'+command.command_id+':accepted','message.accepted',{conversation_id:id,provider_message_id:outcome.providerMessageId,status:'ACCEPTED'});
  await db.query('COMMIT');return {id:claimedId,status:'ACCEPTED',reused:false};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});if(claimedId)throw Error('REPLY_OUTCOME_UNCONFIRMED');throw e}finally{db.release()}
}
