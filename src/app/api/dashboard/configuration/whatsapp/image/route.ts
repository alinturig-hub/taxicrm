import { NextResponse } from "next/server";
import { whatsappAccess, whatsappOrigin, privateHeaders } from "@/lib/integrations/whatsapp/access";
import { reserveWhatsAppList } from "@/lib/integrations/whatsapp/limit";
import { WhatsAppError } from "@/lib/integrations/whatsapp/settings";
import { uploadTemplateImage } from "@/lib/integrations/whatsapp/template-upload";
export const runtime="nodejs";
export async function POST(request:Request){
 let release:(()=>void)|undefined;
 try{
  const access=await whatsappAccess(true);whatsappOrigin(request);release=reserveWhatsAppList(access.user.id);
  const reader=request.body?.getReader();if(!reader)throw new WhatsAppError("INVALID_TEMPLATE_IMAGE");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024){await reader.cancel();throw new WhatsAppError("INVALID_TEMPLATE_IMAGE",413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return NextResponse.json(await uploadTemplateImage(bytes),{headers:privateHeaders});
 }catch(error){return NextResponse.json({error:error instanceof WhatsAppError?error.code:"TEMPLATE_IMAGE_UPLOAD_FAILED"},{status:error instanceof WhatsAppError?error.status:503,headers:privateHeaders});}
 finally{release?.();}
}
