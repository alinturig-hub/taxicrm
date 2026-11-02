import {WhatsAppError} from "./settings";
export type TemplateButton = {type:"URL"|"PHONE_NUMBER"|"QUICK_REPLY";text:string;url?:string;phone_number?:string};
export type ImageHeader = {format:"IMAGE";handle:string};
export function extraTemplateComponents(header:unknown,buttons:unknown){
 const components:Record<string,unknown>[]=[];
 if(header!==undefined){
 if(!header||typeof header!=="object"||Array.isArray(header))throw new WhatsAppError("INVALID_IMAGE_HEADER");
 const h=header as Record<string,unknown>;
 if(Object.keys(h).some(k=>!["format","handle"].includes(k))||h.format!=="IMAGE"||typeof h.handle!=="string"||!h.handle.trim()||h.handle.length>4096||/[\s\x00-\x1f]/.test(h.handle)||/^https?:/i.test(h.handle))throw new WhatsAppError("INVALID_IMAGE_HEADER");
 components.push({type:"HEADER",format:"IMAGE",example:{header_handle:[h.handle]}});
 }
 if(buttons!==undefined){
 if(!Array.isArray(buttons)||buttons.length>3)throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
 const normalized=buttons.map((b:unknown)=>{
 if(!b||typeof b!=="object"||Array.isArray(b))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
 const x=b as Record<string,unknown>;
 if(typeof x.text!=="string"||!x.text.trim()||x.text.length>25||/[\x00-\x1f{}]/.test(x.text))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
 const allowed=x.type==="URL"?["type","text","url"]:x.type==="PHONE_NUMBER"?["type","text","phone_number"]:["type","text"];
 if(Object.keys(x).some(k=>!allowed.includes(k)))throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
 if(x.type==="QUICK_REPLY")return {type:x.type,text:x.text};
 if(x.type==="PHONE_NUMBER"&&typeof x.phone_number==="string"&&/^\+[1-9]\d{7,14}$/.test(x.phone_number))return {type:x.type,text:x.text,phone_number:x.phone_number};
 if(x.type==="URL"&&typeof x.url==="string"&&x.url.length<=2000&&!/[\s{}]/.test(x.url)){
 try{const u=new URL(x.url);if(u.protocol==="https:"&&!u.username&&!u.password)return {type:x.type,text:x.text,url:u.href};}catch{}
 }
 throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
 });
 if(normalized.filter(x=>x.type==="URL").length>2||normalized.filter(x=>x.type==="PHONE_NUMBER").length>1)throw new WhatsAppError("INVALID_TEMPLATE_BUTTONS");
 if(normalized.length)components.push({type:"BUTTONS",buttons:normalized});
 }
 return components;
}
