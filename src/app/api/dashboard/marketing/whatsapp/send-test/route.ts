import {NextResponse} from "next/server";
import {Pool} from "pg";
import {whatsappAccess,whatsappOrigin,whatsappBody,privateHeaders} from "@/lib/integrations/whatsapp/access";
import {WhatsAppError} from "@/lib/integrations/whatsapp/settings";
import {sendControlledTest} from "@/lib/integrations/whatsapp/send-test";
import {reserveWhatsAppList} from "@/lib/integrations/whatsapp/limit";
export const dynamic="force-dynamic";
let pool:Pool|undefined;
export async function POST(request:Request){let release:(()=>void)|undefined;
 try{const access=await whatsappAccess(true);whatsappOrigin(request);const body=await whatsappBody(request);
 if(body.confirmSend!==true||typeof body.operationKey!=="string"||typeof body.recipient!=="string"||Object.keys(body).some(k=>!["operationKey","recipient","confirmSend"].includes(k)))throw new WhatsAppError("INVALID_REQUEST");
 release=reserveWhatsAppList(access.user.id);
 pool??=new Pool({connectionString:process.env.DATABASE_URL,max:2});
 // Each SQL statement commits separately: claim is durable BEFORE the provider call.
 const result=await sendControlledTest({operationKey:body.operationKey,recipient:body.recipient,actorUserId:access.user.id},{query:async(sql,values)=>pool!.query(sql,values)});
 return NextResponse.json(result,{headers:privateHeaders});
 }catch(e){return NextResponse.json({error:e instanceof WhatsAppError?e.code:"TEST_SEND_UNAVAILABLE_DO_NOT_RETRY_WITH_NEW_KEY"},{status:e instanceof WhatsAppError?e.status:503,headers:privateHeaders});}finally{release?.();}
}
