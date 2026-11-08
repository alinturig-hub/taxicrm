import {authenticate,failure} from '@/lib/integrations/whatsapp/service-http';
import {handoff,sharedPool,sharedScope,transaction} from '@/lib/integrations/whatsapp/shared';
import {operatorReply} from '@/lib/integrations/whatsapp/operator-reply';
import {ownerTestGuard} from '@/lib/integrations/whatsapp/operator-owner-test';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:{id:string}}){try{
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(params.id))throw Error('INVALID_COMMAND');
 const {scope}=await authenticate(request);const row=(await sharedPool().query(`SELECT id,mode,revision,participant FROM "WhatsAppConversation" WHERE scope=$1 AND id=$2`,[scope,params.id])).rows[0];if(!row)throw Error('NOT_FOUND');
 const grant=(await sharedPool().query(`SELECT suppressed FROM "WhatsAppRecipientGrant" WHERE scope=$1 AND recipient=$2`,[scope,row.participant])).rows[0];
 const stop=!grant&&(await sharedPool().query(`SELECT 1 FROM "WhatsAppMessage" WHERE scope=$1 AND "conversationId"=$2 AND direction='INBOUND' AND upper(trim(content->>'text')) IN ('STOP','UNSUBSCRIBE','STOP ALL') LIMIT 1`,[scope,params.id])).rowCount!>0;
 let canControl=true,canReply=true;try{ownerTestGuard(process.env,row.participant,row.mode==='OPERATOR'?'release':'takeover')}catch{canControl=false}try{ownerTestGuard(process.env,row.participant,'reply')}catch{canReply=false}
 const latest=(await sharedPool().query(`SELECT max("occurredAt") AS at FROM "WhatsAppMessage" WHERE scope=$1 AND "conversationId"=$2 AND direction='INBOUND' AND status='RECEIVED' AND "occurredAt"<=now()`,[scope,params.id])).rows[0]?.at;
 const unresolved=(await sharedPool().query(`SELECT 1 FROM "WhatsAppOutboundMessage" WHERE "connectionKey"=$1 AND "templateSnapshot"->>'origin'='operator_reply' AND "templateSnapshot"->>'conversationId'=$2 AND status IN ('SENDING','UNKNOWN') LIMIT 1`,[scope,params.id])).rowCount!>0;
 return Response.json({id:row.id,mode:row.mode,revision:row.revision,owner_test_mode:process.env.WHATSAPP_OPERATOR_OWNER_TEST_MODE==='true',recipient_available:typeof row.participant==='string'&&/^\+[1-9]\d{7,14}$/.test(row.participant),suppressed:!!grant?.suppressed||!!stop,unresolved_reply:unresolved,window_expires_at:latest?new Date(new Date(latest).getTime()+86400000).toISOString():null,controls_enabled:canControl&&process.env.WHATSAPP_OPERATOR_CONTROLS_ENABLED==='true',reply_enabled:canReply&&process.env.WHATSAPP_OPERATOR_CONTROLS_ENABLED==='true'&&process.env.WHATSAPP_OPERATOR_REPLY_ENABLED==='true'&&process.env.META_WHATSAPP_SENDING_ENABLED==='true'},{headers:{'Cache-Control':'no-store'}});
}catch(e){return replyFailure(e)}}
export async function POST(request:Request,{params}:{params:{id:string}}){try{
 if(process.env.WHATSAPP_OPERATOR_CONTROLS_ENABLED!=='true')throw Error('OPERATOR_CONTROLS_DISABLED');
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(params.id))throw Error('INVALID_COMMAND');
 const {body}=await authenticate(request);const data=JSON.parse(body) as Record<string,unknown>;
 if(data.action==='reply'){if(Object.keys(data).sort().join(',')!=='action,command_id,revision,text')throw Error('INVALID_COMMAND');return Response.json(await operatorReply(params.id,{command_id:data.command_id,revision:data.revision,text:data.text}),{headers:{'Cache-Control':'no-store'}})}
 if(!['takeover','release'].includes(String(data.action))||Object.keys(data).sort().join(',')!=='action,command_id,revision'||typeof data.command_id!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(data.command_id)||!Number.isSafeInteger(data.revision)||Number(data.revision)<0)throw Error('INVALID_COMMAND');
 const mode=data.action==='takeover'?'OPERATOR':'AUTOMATED';
 const result=await transaction(db=>handoff(db,sharedScope(),params.id,{id:data.command_id as string,mode,revision:data.revision as number},'service:needacabplus-admin',participant=>{ownerTestGuard(process.env,participant,data.action==='takeover'?'takeover':'release')}));
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return replyFailure(e)}}

function replyFailure(e:unknown){const code=e instanceof Error?e.message:'';if(['WHATSAPP_WINDOW_CLOSING','RECIPIENT_PHONE_UNAVAILABLE','RECIPIENT_SUPPRESSED','PREVIOUS_REPLY_UNRESOLVED','OWNER_TEST_RECIPIENT_NOT_ALLOWED','OWNER_TEST_BODY_MISMATCH','OWNER_TEST_EXPIRED','OWNER_TEST_CONFIGURATION_INVALID','OWNER_TEST_OTHER_SENDERS_NOT_DISABLED'].includes(code))return Response.json({error:code},{status:409,headers:{'Cache-Control':'no-store'}});return failure(e)}
