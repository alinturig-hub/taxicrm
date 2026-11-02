import {verifyMetaChallenge,verifyMetaSignature} from "@/lib/integrations/whatsapp/webhook";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){
 try{return new Response(verifyMetaChallenge(new URL(request.url).searchParams,process.env.META_WHATSAPP_VERIFY_TOKEN),{headers});}
 catch(e){return new Response("Verification unavailable",{status:e instanceof Error&&e.message==="WEBHOOK_NOT_CONFIGURED"?503:403,headers});}
}
export async function POST(request:Request){
 try{
 const reader=request.body?.getReader();if(!reader)return new Response("Body required",{status:400,headers});
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>262144){await reader.cancel();return new Response("Payload too large",{status:413,headers});}chunks.push(part.value);}
 const raw=Buffer.concat(chunks);
 if(!verifyMetaSignature(raw,request.headers.get("x-hub-signature-256"),process.env.META_WHATSAPP_APP_SECRET))return new Response("Invalid signature",{status:401,headers});
 // Never acknowledge and discard. Durable WhatsApp inbox must precede subscription.
 return new Response("Durable webhook inbox not activated",{status:503,headers:{...headers,"Retry-After":"60"}});
 }catch{return new Response("Webhook unavailable",{status:503,headers});}
}
