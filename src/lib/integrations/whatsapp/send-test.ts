import {claimOutbound,enqueueOutbound,type OutboxTransaction} from "./outbox";
import {sendMetaTemplate} from "./meta-send";
import {WhatsAppError,whatsappCredentials} from "./settings";
export async function sendControlledTest(input:{operationKey:string;recipient:string;actorUserId:string},tx:OutboxTransaction,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 if(env.META_WHATSAPP_SENDING_ENABLED!=="true"||env.META_WHATSAPP_TEST_SEND_ENABLED!=="true")throw new WhatsAppError("TEST_SEND_DISABLED",503);
 const c=whatsappCredentials(env);const phone=env.META_WHATSAPP_PHONE_NUMBER_ID||"";
 if(!/^\d{5,32}$/.test(phone)||!/^\+[1-9]\d{7,14}$/.test(input.recipient)||!env.META_WHATSAPP_TEST_RECIPIENTS?.split(',').map(x=>x.trim()).includes(input.recipient))throw new WhatsAppError("TEST_RECIPIENT_NOT_ALLOWED",403);
 if(!/^[a-zA-Z0-9_-]{16,100}$/.test(input.operationKey))throw new WhatsAppError("INVALID_OPERATION_KEY");
 const connectionKey=`META:${c.wabaId}:${phone}`;
 const template={name:"hello_world",language:"en_US",parameters:[] as string[]};
 const row=await enqueueOutbound(tx,{connectionKey,operationKey:input.operationKey,actorUserId:input.actorUserId,recipient:input.recipient,templateSnapshot:template,purpose:"SERVICE",eligibilityEvidence:{mode:"OPERATOR_TEST",allowlisted:true}});
 const claimed=await claimOutbound(tx,connectionKey,row.id);if(!claimed)return {id:row.id,status:row.status,reused:true};
 let outcome:Awaited<ReturnType<typeof sendMetaTemplate>>;
 try{outcome=await sendMetaTemplate({...template,recipient:input.recipient},env,fetcher);}catch(e){
 const status=e instanceof WhatsAppError&&["META_ACCESS_DENIED","META_RATE_LIMITED","META_SEND_REJECTED","INVALID_TEMPLATE_SEND"].includes(e.code)?"REJECTED":"UNKNOWN";
 await tx.query(`UPDATE "WhatsAppOutboundMessage" SET "status"=$3,"finishedAt"=now() WHERE "connectionKey"=$1 AND "id"=$2 AND "status"='SENDING' RETURNING "id","requestHash","status"`,[connectionKey,row.id,status]);
 return {id:row.id,status,reused:false};
 }
 // If this write fails, keep SENDING: do not resend after an accepted provider call.
 await tx.query(`UPDATE "WhatsAppOutboundMessage" SET "status"='ACCEPTED',"providerMessageId"=$3,"finishedAt"=now() WHERE "connectionKey"=$1 AND "id"=$2 AND "status"='SENDING' RETURNING "id","requestHash","status"`,[connectionKey,row.id,outcome.providerMessageId]);
 return {id:row.id,status:"ACCEPTED",reused:false};
}
