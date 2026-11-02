import {NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {whatsappAccess,privateHeaders} from "@/lib/integrations/whatsapp/access";
import {WhatsAppError} from "@/lib/integrations/whatsapp/settings";
import {projectInbox} from "@/lib/integrations/whatsapp/inbox-projection";
export const dynamic="force-dynamic";
export async function GET(){
 try{await whatsappAccess();const waba=process.env.META_WHATSAPP_WABA_ID;if(!waba||!/^\d{5,32}$/.test(waba))return NextResponse.json({error:"WABA_NOT_CONFIGURED"},{status:503,headers:privateHeaders});
 const rows=await prisma.$queryRaw<{rawBody:string;receivedAt:Date}[]>`SELECT "rawBody","receivedAt" FROM "WhatsAppWebhookInbox" WHERE "connectionKey"=${`META:${waba}`} ORDER BY "receivedAt" DESC,"id" DESC LIMIT 201`;
 const projected=projectInbox(rows.slice(0,200).map(r=>r.rawBody),waba);
 return NextResponse.json({...projected,envelopes:Math.min(rows.length,200),hasMore:rows.length>200,latestReceivedAt:rows[0]?.receivedAt||null,generatedAt:new Date().toISOString()},{headers:privateHeaders});
 }catch(e){return NextResponse.json({error:e instanceof WhatsAppError?e.code:"INBOX_UNAVAILABLE"},{status:e instanceof WhatsAppError?e.status:503,headers:privateHeaders});}
}
