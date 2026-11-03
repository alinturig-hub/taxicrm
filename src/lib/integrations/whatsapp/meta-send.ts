import {whatsappCredentials,WhatsAppError} from "./settings";
import {boundedJson} from "./templates";
export type MetaTemplateSend={recipient:string;name:string;language:string;parameters:string[]};
/** Internal transport only. Runtime caller must first durably claim an outbound operation. */
export async function sendMetaTemplate(input:MetaTemplateSend,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 if(env.META_WHATSAPP_SENDING_ENABLED!=="true")throw new WhatsAppError("WHATSAPP_SENDING_DISABLED",503);
 const config=whatsappCredentials(env),phone=env.META_WHATSAPP_PHONE_NUMBER_ID||"";
 if(!/^\d{5,32}$/.test(phone)||!/^\+[1-9]\d{7,14}$/.test(input.recipient)||!/^[a-z0-9_]{1,512}$/.test(input.name)||!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(input.language)||input.parameters.length>10||input.parameters.some(x=>!x.trim()||x.length>1024||/[\x00-\x1f]/.test(x)))throw new WhatsAppError("INVALID_TEMPLATE_SEND");
 const payload={messaging_product:"whatsapp",to:input.recipient.slice(1),type:"template",template:{name:input.name,language:{code:input.language},...(input.parameters.length?{components:[{type:"body",parameters:input.parameters.map(text=>({type:"text",text}))}]}:{})}};
 try{
 const response=await fetcher(`https://graph.facebook.com/${config.graphVersion}/${phone}/messages`,{method:"POST",headers:{Authorization:`Bearer ${config.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify(payload),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new WhatsAppError(response.status===401||response.status===403?"META_ACCESS_DENIED":response.status===429?"META_RATE_LIMITED":"META_SEND_REJECTED",502);
 const result=await boundedJson(response);
 const message=Array.isArray(result.messages)?result.messages[0]:null;
 if(!message||typeof message.id!=="string"||!message.id||message.id.length>512)throw new WhatsAppError("META_SEND_OUTCOME_UNKNOWN",502);
 return {providerMessageId:message.id,status:"ACCEPTED" as const};
 }catch(e){
 if(e instanceof WhatsAppError&&["META_ACCESS_DENIED","META_RATE_LIMITED","META_SEND_REJECTED"].includes(e.code))throw e;
 throw new WhatsAppError("META_SEND_OUTCOME_UNKNOWN",502);
 }
}
