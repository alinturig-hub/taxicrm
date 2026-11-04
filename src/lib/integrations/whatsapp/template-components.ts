import {WhatsAppError} from "./settings";
import {parameterExample,type ParameterFormat} from "./template-parameters";
export type TemplateButton = {type:"URL"|"PHONE_NUMBER"|"QUICK_REPLY"|"COPY_CODE"|"FLOW";text:string;url?:string;phone_number?:string;example?:string;flow_id?:string};
export type ImageHeader = {format:"IMAGE"|"VIDEO"|"DOCUMENT";handle:string}|{format:"LOCATION"}|{format:"TEXT";text:string;samples?:string[]};
export function extraTemplateComponents(header:unknown,buttons:unknown,format:ParameterFormat="POSITIONAL"){
 const components:Record<string,unknown>[]=[];
 if(header!==undefined){
  if(!header||typeof header!=="object"||Array.isArray(header))throw new WhatsAppError("INVALID_IMAGE_HEADER");
  const h=header as Record<string,unknown>;
  if(h.format==="TEXT"){
   if(Object.keys(h).some(k=>!["format","text","samples"].includes(k))||typeof h.text!=="string"||!h.text.trim()||h.text.length>60||/[\x00-\x1f]/.test(h.text))throw new WhatsAppError("INVALID_IMAGE_HEADER");
   const {example}=parameterExample(h.text,h.samples||[],format,"header");components.push({type:"HEADER",format:"TEXT",text:h.text,...(example?{example}:{})});
  }else if(h.format==="LOCATION"){
   if(Object.keys(h).some(k=>k!=="format"))throw new WhatsAppError("INVALID_IMAGE_HEADER");components.push({type:"HEADER",format:"LOCATION"});
  }else{
   if(Object.keys(h).some(k=>!["format","handle"].includes(k))||!["IMAGE","VIDEO","DOCUMENT"].includes(String(h.format))||typeof h.handle!=="string"||!h.handle.trim()||h.handle.length>4096||/[\s\x00-\x1f]/.test(h.handle)||/^https?:/i.test(h.handle))throw new WhatsAppError("INVALID_IMAGE_HEADER");
   components.push({type:"HEADER",format:h.format,example:{header_handle:[h.handle]}});
  }
 }
 if(buttons!==undefined){
  if(!Array.isArray(buttons)||buttons.length>10)throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
  const normalized=buttons.map((b:unknown)=>{
   if(!b||typeof b!=="object"||Array.isArray(b))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");const x=b as Record<string,unknown>;
   const fields:Record<string,string[]>={URL:["type","text","url","example"],PHONE_NUMBER:["type","text","phone_number"],QUICK_REPLY:["type","text"],COPY_CODE:["type","text","example"],FLOW:["type","text","flow_id"]};
   if(!fields[String(x.type)]||Object.keys(x).some(k=>!fields[String(x.type)].includes(k)))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
   if(x.type==="COPY_CODE"){
    if(typeof x.example!=="string"||!x.example.trim()||x.example.length>20||/[\x00-\x1f]/.test(x.example))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");return {type:"COPY_CODE",example:x.example};
   }
   if(typeof x.text!=="string"||!x.text.trim()||x.text.length>25||/[\x00-\x1f{}]/.test(x.text))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
   if(x.type==="QUICK_REPLY")return {type:x.type,text:x.text};
   if(x.type==="FLOW"&&typeof x.flow_id==="string"&&/^\d{5,32}$/.test(x.flow_id))return {type:x.type,text:x.text,flow_id:x.flow_id};
   if(x.type==="PHONE_NUMBER"&&typeof x.phone_number==="string"&&/^\+[1-9]\d{7,14}$/.test(x.phone_number))return {type:x.type,text:x.text,phone_number:x.phone_number};
   if(x.type==="URL"&&typeof x.url==="string"&&x.url.length<=2000&&!/\s/.test(x.url)){
    const dynamic=x.url.endsWith("{{1}}");const raw=dynamic?x.url.slice(0,-5):x.url;
    if(/[{}]/.test(raw))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
    if(dynamic&&(typeof x.example!=="string"||!x.example.trim()||x.example.length>200||/[\s{}]/.test(x.example)))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
    try{const u=new URL(raw);if(u.protocol==="https:"&&!u.username&&!u.password&&(!dynamic||raw.startsWith(u.origin+"/")||raw.startsWith(u.origin+"?")))return {type:x.type,text:x.text,url:x.url,...(dynamic?{example:[x.example]}:{})};}catch{}
   }
   throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
  });
  for(const [type,max] of [["URL",2],["PHONE_NUMBER",1],["COPY_CODE",1],["FLOW",1]] as const)if(normalized.filter(x=>x.type===type).length>max)throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
  // Keep Flow combinations narrow until account-specific combinations are verified.
  if(normalized.some(x=>x.type==="FLOW")&&normalized.length!==1)throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
  const groups=normalized.map(x=>x.type==="QUICK_REPLY"?"reply":"action").filter((x,i,a)=>!i||a[i-1]!==x);
  if(groups.length>2)throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
  if(normalized.length)components.push({type:"BUTTONS",buttons:normalized});
 }
 return components;
}
