import type { TemplateDraft } from "./templates";
import type { TemplateButton, ImageHeader } from "./template-components";
import { parameterKeys } from "./template-parameters";
import { WhatsAppError, whatsappCredentials } from "./settings";
import { boundedJson, templatePreview } from "./templates";
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
export function editableTemplate(item:Record<string,unknown>):{draft?:TemplateDraft;editReason?:string}{
 try{
  if(!["UTILITY","MARKETING"].includes(String(item.category))||!["en_GB","en_US","ro"].includes(String(item.language)))throw Error();
  if(!Array.isArray(item.components)||item.components.some(c=>!c||typeof c!=="object"||!["HEADER","BODY","FOOTER","BUTTONS"].includes(c.type)))throw Error();
  const parts=item.components as Record<string,unknown>[];
  const fields:Record<string,string[]>={HEADER:["type","format","text","example"],BODY:["type","text","example"],FOOTER:["type","text"],BUTTONS:["type","buttons"]};
  if(parts.some(c=>Object.keys(c).some(k=>!fields[String(c.type)].includes(k))))throw Error();
  for(const type of ["BODY","HEADER","FOOTER","BUTTONS"])if(parts.filter(c=>c.type===type).length>(type==="BODY"?1:1))throw Error();
  const body=parts.find(c=>c.type==="BODY");if(!body||typeof body.text!=="string"||body.text.length>1024)throw Error();
  const parameterFormat=item.parameter_format==="NAMED"?"NAMED":"POSITIONAL";
  const samplesFor=(c:Record<string,unknown>,section:"body"|"header")=>{
   const keys=parameterKeys(String(c.text),parameterFormat),ex=object(c.example);
   const named=ex[`${section}_text_named_params`];
   const list=Array.isArray(named)?named.map(object):[];
   const bodyRows=Array.isArray(ex.body_text)?ex.body_text:[];
   const positional=section==="body"?(Array.isArray(bodyRows[0])?bodyRows[0]:[]):(Array.isArray(ex.header_text)?ex.header_text:[]);
   return keys.map((k,i)=>{const v=parameterFormat==="NAMED"?list.find(v=>v.param_name===k)?.example:positional[i];return typeof v==="string"&&v.length<=200?v:"";});
  };
  const draft:TemplateDraft={name:String(item.name),language:String(item.language),category:String(item.category),parameterFormat,text:body.text,samples:samplesFor(body,"body")};
  const h=parts.find(c=>c.type==="HEADER");
  if(h){
   if(h.format==="TEXT"&&typeof h.text==="string"&&h.text.length<=60)draft.header={format:"TEXT",text:h.text,samples:samplesFor(h,"header")};
   else if(h.format==="LOCATION")draft.header={format:"LOCATION"};
   else if(["IMAGE","VIDEO","DOCUMENT"].includes(String(h.format)))draft.header={format:h.format,handle:Array.isArray(object(h.example).header_handle)&&typeof (object(h.example).header_handle as unknown[])[0]==="string"?(object(h.example).header_handle as string[])[0]:""} as ImageHeader;
   else throw Error();
  }
  const footer=parts.find(c=>c.type==="FOOTER");if(footer){if(typeof footer.text!=="string"||footer.text.length>60)throw Error();draft.footer=footer.text;}
  const btn=parts.find(c=>c.type==="BUTTONS");
  if(btn){if(!Array.isArray(btn.buttons)||btn.buttons.length>10)throw Error();draft.buttons=btn.buttons.map((value:unknown)=>{
   const b=object(value);
   const allowed:Record<string,string[]>={URL:["type","text","url","example"],PHONE_NUMBER:["type","text","phone_number"],QUICK_REPLY:["type","text"],COPY_CODE:["type","text","example"],FLOW:["type","text","flow_id"]};
   if(!allowed[String(b.type)]||Object.keys(b).some(k=>!allowed[String(b.type)].includes(k)))throw Error();
   const x:TemplateButton={type:b.type as TemplateButton["type"],text:typeof b.text==="string"?b.text:""};
   for(const key of ["url","phone_number","flow_id"] as const)if(b[key]!==undefined){if(typeof b[key]!=="string")throw Error();x[key]=b[key];}
   if(b.example!==undefined){const v=Array.isArray(b.example)?b.example[0]:b.example;if(typeof v!=="string")throw Error();x.example=v;}
   return x;
  });}
  return {draft};
 }catch{return {editReason:"This template contains a format not supported by this editor. Edit it in WhatsApp Manager to preserve all components."};}
}
export async function editTemplate(id:unknown,input:unknown,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 const config=whatsappCredentials(env);if(!config.templateSubmissionEnabled)throw new WhatsAppError("TEMPLATE_SUBMISSION_DISABLED",503);
 if(typeof id!=="string"||!/^\d{1,64}$/.test(id))throw new WhatsAppError("INVALID_TEMPLATE_ID");
 const candidate=templatePreview(input);const draft=input as TemplateDraft;
 // Verify ownership against this configured account; never accept an arbitrary Graph node ID.
 const url=new URL(`https://graph.facebook.com/${config.graphVersion}/${config.wabaId}/message_templates`);
 url.searchParams.set("name",draft.name);url.searchParams.set("fields","id,name,language,category,status,parameter_format");url.searchParams.set("limit","100");
 let attempted=false;
 try{
  const options={headers:{Authorization:`Bearer ${config.accessToken}`},cache:"no-store" as const,redirect:"error" as const,signal:AbortSignal.timeout(8000)};
  const check=await fetcher(url,{...options,method:"GET"});if(!check.ok)throw new WhatsAppError("META_ACCESS_DENIED",502);
  const data=await boundedJson(check);const found=Array.isArray(data.data)?data.data.find(x=>x?.id===id):undefined;
  if(!found||found.name!==draft.name||found.language!==draft.language||found.category!==draft.category||(found.parameter_format||"POSITIONAL")!==(draft.parameterFormat||"POSITIONAL"))throw new WhatsAppError("TEMPLATE_EDIT_SCOPE_MISMATCH",403);
  if(!["APPROVED","REJECTED","PAUSED"].includes(found.status))throw new WhatsAppError("TEMPLATE_NOT_EDITABLE",409);
  attempted=true;
  const response=await fetcher(`https://graph.facebook.com/${config.graphVersion}/${id}`,{method:"POST",headers:{Authorization:`Bearer ${config.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({components:candidate.payload.components}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new WhatsAppError(response.status>=500?"TEMPLATE_SUBMISSION_UNCONFIRMED":"TEMPLATE_EDIT_REJECTED",502);
  const result=await boundedJson(response);if(result.success!==true)throw new WhatsAppError("TEMPLATE_SUBMISSION_UNCONFIRMED",502);
  return {id,status:"CHECK_META_STATUS",submitted:true,edited:true};
 }catch(error){if(attempted&&(!(error instanceof WhatsAppError)||!["TEMPLATE_EDIT_REJECTED","TEMPLATE_SUBMISSION_UNCONFIRMED"].includes(error.code)))throw new WhatsAppError("TEMPLATE_SUBMISSION_UNCONFIRMED",502);if(error instanceof WhatsAppError)throw error;throw new WhatsAppError("TEMPLATE_SUBMISSION_UNCONFIRMED",502);}
}
