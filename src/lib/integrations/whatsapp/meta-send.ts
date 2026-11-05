import {whatsappCredentials,WhatsAppError} from './settings';
import {boundedJson} from './templates';
import {positionalTemplatePayload,type MetaPayload} from './operational-adapters';
export type MetaTemplateSend={recipient:string;name:string;language:string;parameters:string[]};
/** The one Meta HTTP transport. Internal only: caller owns the durable claim and policy lock.
 * Text additionally requires the eligible inbound deadline checked at the actual HTTP boundary. */
export async function sendMetaPayload(payload:MetaPayload,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch,options:{textWindowExpiresAt?:number}={}){
 if(env.META_WHATSAPP_SENDING_ENABLED!=='true')throw new WhatsAppError('WHATSAPP_SENDING_DISABLED',503);
 const config=whatsappCredentials(env),phone=env.META_WHATSAPP_PHONE_NUMBER_ID||'';
 if(!/^\d{5,32}$/.test(phone)||payload.messaging_product!=='whatsapp'||!/^\d{8,15}$/.test(payload.to)||!['text','template'].includes(payload.type))throw new WhatsAppError('INVALID_TEMPLATE_SEND');
 if(payload.type==='text'&&(!payload.text?.body.trim()||payload.text.body.length>4096||!Number.isFinite(options.textWindowExpiresAt)||Number(options.textWindowExpiresAt)-Date.now()<=8000))throw new WhatsAppError('WHATSAPP_WINDOW_CLOSING');
 try{
 const response=await fetcher(`https://graph.facebook.com/${config.graphVersion}/${phone}/messages`,{method:'POST',headers:{Authorization:`Bearer ${config.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(response.status>=500)throw new WhatsAppError('META_SEND_OUTCOME_UNKNOWN',502);
 if(!response.ok)throw new WhatsAppError(response.status===401||response.status===403?'META_ACCESS_DENIED':response.status===429?'META_RATE_LIMITED':'META_SEND_REJECTED',502);
 const result=await boundedJson(response),message=Array.isArray(result.messages)?result.messages[0]:null;
 if(!message||typeof message.id!=='string'||!message.id||message.id.length>512)throw new WhatsAppError('META_SEND_OUTCOME_UNKNOWN',502);
 return {providerMessageId:message.id,status:'ACCEPTED' as const};
 }catch(e){
 if(e instanceof WhatsAppError&&['META_ACCESS_DENIED','META_RATE_LIMITED','META_SEND_REJECTED'].includes(e.code))throw e;
 throw new WhatsAppError('META_SEND_OUTCOME_UNKNOWN',502);
 }
}
/** Existing v1 entrypoint retains its approval/claim flow and shares serialization/transport. */
export async function sendMetaTemplate(input:MetaTemplateSend,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 if(env.META_WHATSAPP_SENDING_ENABLED!=='true')throw new WhatsAppError('WHATSAPP_SENDING_DISABLED',503);
 let payload;try{payload=positionalTemplatePayload(input.recipient,input.name,input.language,input.parameters)}catch{throw new WhatsAppError('INVALID_TEMPLATE_SEND')}
 return sendMetaPayload(payload,env,fetcher);
}
