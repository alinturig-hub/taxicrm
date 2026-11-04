import {createHash,randomUUID} from 'node:crypto';
import {Pool,PoolClient} from 'pg';
import {projectInbox} from './inbox-projection';
let pool:Pool|undefined;
export function sharedPool(){return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:4});}
export function sharedScope(env:NodeJS.ProcessEnv=process.env){
 const workspace=env.WHATSAPP_WORKSPACE_ID,waba=env.META_WHATSAPP_WABA_ID,phone=env.META_WHATSAPP_PHONE_NUMBER_ID;
 if(!workspace||!/^[a-zA-Z0-9_-]{1,64}$/.test(workspace)||!/^\d{5,32}$/.test(waba||'')||!/^\d{5,32}$/.test(phone||''))throw Error('WHATSAPP_SERVICE_NOT_CONFIGURED');
 return `${workspace}:META:${waba}:${phone}`;
}
export async function transaction<T>(run:(db:PoolClient)=>Promise<T>){const db=await sharedPool().connect();try{await db.query('BEGIN');const result=await run(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
export function stable(value:unknown):string{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stable).join(',')+']';const r=value as Record<string,unknown>;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+stable(r[k])).join(',')+'}';}
const hash=(value:unknown)=>createHash('sha256').update(stable(value)).digest('hex');
export async function emit(db:PoolClient,scope:string,key:string,type:string,payload:unknown){await db.query(`INSERT INTO "WhatsAppSharedEvent" (scope,"eventKey",type,payload) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT(scope,"eventKey") DO NOTHING`,[scope,key,type,JSON.stringify(payload)]);}
export async function conversation(db:PoolClient,scope:string,participant:string){
 await db.query(`INSERT INTO "WhatsAppConversation" (id,scope,participant) VALUES ($1,$2,$3) ON CONFLICT(scope,participant) DO NOTHING`,[randomUUID(),scope,participant]);
 return (await db.query(`SELECT * FROM "WhatsAppConversation" WHERE scope=$1 AND participant=$2 FOR UPDATE`,[scope,participant])).rows[0];
}
/** Worker replays captured receipts. Canonical dedup survives different envelope batches. */
export async function materialize(db:PoolClient,scope:string,raw:string,waba:string,phone:string){
 const projection=projectInbox([raw],waba);if(projection.invalid)throw Error('INVALID_ENVELOPE');
 for(const m of projection.messages){
 if(m.phoneNumberId!==phone||m.participant==='Unknown recipient')continue;
 const phoneParticipant=m.participantPhone||'',participant=/^\+?[1-9]\d{7,14}$/.test(phoneParticipant)?'+'+phoneParticipant.replace(/^\+/, ''):m.participant;
 const existing=(await db.query(`SELECT id FROM "WhatsAppConversation" WHERE scope=$1 AND participant=$2`,[scope,participant])).rows[0];
 if(existing)await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope+':conversation:'+existing.id]);
 const conv=await conversation(db,scope,participant);
 if(m.direction==='INBOUND'&&/^(STOP|UNSUBSCRIBE|STOP ALL)$/i.test(m.text.trim())){await db.query(`UPDATE "WhatsAppRecipientGrant" SET suppressed=true,"updatedAt"=now() WHERE scope=$1 AND recipient=$2`,[scope,participant]);await db.query(`UPDATE "WhatsAppServiceIntent" SET status='CANCELLED',"lastReason"='RECIPIENT_SUPPRESSED' WHERE scope=$1 AND "conversationId"=$2 AND status='HELD'`,[scope,conv.id]);}
 const old=(await db.query(`SELECT * FROM "WhatsAppMessage" WHERE scope=$1 AND "providerMessageId"=$2 FOR UPDATE`,[scope,m.id])).rows[0];
 if(old&&old.conversationId!==conv.id)throw Error('MESSAGE_PARTICIPANT_CONFLICT');
 const rank:Record<string,number>={FAILED:2.5,ACCEPTED:1,SENT:2,DELIVERED:3,READ:4,RECEIVED:4};
 if(old&&(rank[m.status]??-1)<=(rank[old.status]??-1))continue;
 const content={text:m.text,type:m.type,providerParticipant:m.participant,origin:m.direction==='INBOUND'?'customer':'provider_status'};
 const result=await db.query(`INSERT INTO "WhatsAppMessage" (scope,"conversationId","providerMessageId",direction,content,status,"occurredAt") VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) ON CONFLICT(scope,"providerMessageId") DO UPDATE SET status=EXCLUDED.status RETURNING id`,[scope,conv.id,m.id,m.direction,JSON.stringify(content),m.status,m.timestamp]);
 await emit(db,scope,`message:${m.id}:${m.status}`,m.direction==='INBOUND'?'message.received':'message.status',{conversation_id:conv.id,message_id:String(result.rows[0].id),provider_message_id:m.id,status:m.status});
 }
}
export async function handoff(db:PoolClient,scope:string,id:string,command:{id:string;mode:'AUTOMATED'|'OPERATOR';revision:number},actor:string){
 const h=hash({conversation:id,...command,actor});
 // Serializes repeated commands even when the first command has not committed yet.
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope+':'+command.id]);
 const previous=(await db.query(`SELECT * FROM "WhatsAppHandoffCommand" WHERE scope=$1 AND id=$2`,[scope,command.id])).rows[0];
 if(previous){if(previous.requestHash!==h)throw Error('IDEMPOTENCY_CONFLICT');return previous.result;}
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope+':conversation:'+id]);
 const conv=(await db.query(`SELECT * FROM "WhatsAppConversation" WHERE scope=$1 AND id=$2 FOR UPDATE`,[scope,id])).rows[0];
 if(!conv)throw Error('NOT_FOUND');if(conv.revision!==command.revision)throw Error('REVISION_CONFLICT');
 const result=(await db.query(`UPDATE "WhatsAppConversation" SET mode=$3,revision=revision+1,"assignedUserId"=$4,"updatedAt"=now() WHERE scope=$1 AND id=$2 RETURNING id,mode,revision,"assignedUserId"`,[scope,id,command.mode,command.mode==='OPERATOR'?actor:null])).rows[0];
 // Never flush stale held intents after takeover/release.
 await db.query(`UPDATE "WhatsAppServiceIntent" SET status='CANCELLED' WHERE scope=$1 AND "conversationId"=$2 AND status='HELD'`,[scope,id]);
 await db.query(`INSERT INTO "WhatsAppHandoffCommand" (scope,id,"requestHash",result) VALUES ($1,$2,$3,$4::jsonb)`,[scope,command.id,h,JSON.stringify(result)]);
 await emit(db,scope,'handoff:'+command.id,'conversation.mode_changed',result);return result;
}
export type ServiceIntent={schema_version:'1.0';workspace_id:string;idempotency_key:string;recipient:string;booking_id:string;event_type:string;revision:number;template_binding:string;parameters:string[];expires_at:string};
export function validateIntent(x:unknown,now=Date.now(),allowExpired=false):ServiceIntent{
 if(!x||typeof x!=='object'||Array.isArray(x))throw Error('INVALID_INTENT');const v=x as ServiceIntent;
 const keys=['schema_version','workspace_id','idempotency_key','recipient','booking_id','event_type','revision','template_binding','parameters','expires_at'];
 if(Object.keys(x).some(k=>!keys.includes(k))||v.schema_version!=='1.0'||typeof v.workspace_id!=='string'||!/^\+[1-9]\d{7,14}$/.test(v.recipient)||!['booking.confirmed','driver.assigned','driver.arrived','journey.started','journey.completed','booking.cancelled'].includes(v.event_type)||typeof v.booking_id!=='string'||!/^[a-zA-Z0-9:_-]{1,128}$/.test(v.booking_id)||!Number.isSafeInteger(v.revision)||v.revision<0||v.template_binding!==v.event_type||!Array.isArray(v.parameters)||v.parameters.length>10||v.parameters.some(p=>typeof p!=='string'||!p.trim()||p.length>1024||/[\x00-\x1f]/.test(p))||typeof v.expires_at!=='string'||!Number.isFinite(Date.parse(v.expires_at))||(!allowExpired&&Date.parse(v.expires_at)<=now)||Date.parse(v.expires_at)>now+86400000)throw Error('INVALID_INTENT');
 // Same semantic event deduplicates regardless of producer.
 if(v.idempotency_key!==`${v.booking_id}:${v.event_type}:${v.recipient}:${v.revision}`)throw Error('INVALID_IDEMPOTENCY_KEY');return v;
}
export async function acceptIntent(db:PoolClient,scope:string,input:unknown){
 const v=validateIntent(input,Date.now(),true);if(v.workspace_id!==scope.split(':')[0])throw Error('WRONG_SCOPE');
 const h=hash(v),previous=(await db.query(`SELECT id,"requestHash",status,"conversationId" FROM "WhatsAppServiceIntent" WHERE scope=$1 AND "operationKey"=$2`,[scope,v.idempotency_key])).rows[0];
 if(previous){if(previous.requestHash!==h)throw Error('IDEMPOTENCY_CONFLICT');return {id:previous.id,status:previous.status,conversation_id:previous.conversationId,sending_enabled:process.env.WHATSAPP_JOURNEY_SENDING_ENABLED==='true'&&process.env.META_WHATSAPP_SENDING_ENABLED==='true'};}
 validateIntent(v);const conv=await conversation(db,scope,v.recipient);
 await db.query(`INSERT INTO "WhatsAppServiceIntent" (id,scope,"operationKey","requestHash","conversationId",payload,"expiresAt",status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) ON CONFLICT(scope,"operationKey") DO NOTHING`,[randomUUID(),scope,v.idempotency_key,h,conv.id,JSON.stringify(v),v.expires_at,conv.mode==='OPERATOR'?'CANCELLED':'HELD']);
 const row=(await db.query(`SELECT id,"requestHash",status,"conversationId" FROM "WhatsAppServiceIntent" WHERE scope=$1 AND "operationKey"=$2`,[scope,v.idempotency_key])).rows[0];
 if(row.requestHash!==h)throw Error('IDEMPOTENCY_CONFLICT');return {id:row.id,status:row.status,conversation_id:row.conversationId,sending_enabled:process.env.WHATSAPP_JOURNEY_SENDING_ENABLED==='true'&&process.env.META_WHATSAPP_SENDING_ENABLED==='true'};
}
