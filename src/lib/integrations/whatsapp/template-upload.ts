import { WhatsAppError, whatsappCredentials } from "./settings";
import { boundedJson } from "./templates";
export function imageType(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new WhatsAppError("INVALID_TEMPLATE_IMAGE");
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) return "image/png";
  throw new WhatsAppError("INVALID_TEMPLATE_IMAGE");
}
export async function uploadTemplateMedia(bytes: Uint8Array, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  const media=mediaType(bytes), type=media.type, config=whatsappCredentials(env);
  if (!config.templateSubmissionEnabled) throw new WhatsAppError("TEMPLATE_SUBMISSION_DISABLED",503);
  const request=async(url:string,options:RequestInit)=>{
    const response=await fetcher(url,{...options,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new WhatsAppError("TEMPLATE_IMAGE_UPLOAD_FAILED",502);
    return boundedJson(response);
  };
  try {
    const session=new URL(`https://graph.facebook.com/${config.graphVersion}/${config.appId}/uploads`);
    session.searchParams.set("file_name",`template_sample.${media.extension}`);
    session.searchParams.set("file_length",String(bytes.length));session.searchParams.set("file_type",type);
    const created=await request(session.href,{method:"POST",headers:{Authorization:`Bearer ${config.accessToken}`}});
    if(typeof created.id!=="string" || !/^upload:[A-Za-z0-9_:=.?&%+\/-]{1,4096}$/.test(created.id))throw new WhatsAppError("TEMPLATE_IMAGE_UPLOAD_FAILED",502);
    const uploaded=await request(`https://graph.facebook.com/${config.graphVersion}/${created.id}`,{method:"POST",headers:{Authorization:`OAuth ${config.accessToken}`,file_offset:"0","Content-Type":"application/octet-stream"},body:bytes as BodyInit});
    if(typeof uploaded.h!=="string" || !uploaded.h || uploaded.h.length>4096 || /\s/.test(uploaded.h))throw new WhatsAppError("TEMPLATE_IMAGE_UPLOAD_FAILED",502);
    return {handle:uploaded.h,format:media.format};
  }catch(error){if(error instanceof WhatsAppError)throw error;throw new WhatsAppError("TEMPLATE_IMAGE_UPLOAD_FAILED",502);}
}

export function mediaType(bytes:Uint8Array){
 if(!bytes.length||bytes.length>16*1024*1024)throw new WhatsAppError("INVALID_TEMPLATE_IMAGE");
 const prefix=new TextDecoder().decode(bytes.slice(0,12));
 if(prefix.startsWith("%PDF-"))return {type:"application/pdf",extension:"pdf",format:"DOCUMENT" as const};
 if(prefix.slice(4,8)==="ftyp")return {type:"video/mp4",extension:"mp4",format:"VIDEO" as const};
 const type=imageType(bytes);return {type,extension:type==="image/png"?"png":"jpg",format:"IMAGE" as const};
}
export async function uploadTemplateImage(bytes:Uint8Array,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 imageType(bytes);const {handle}=await uploadTemplateMedia(bytes,env,fetcher);return {handle};
}
