import { createHash } from 'node:crypto';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { requireAdministrationPermission } from '@/lib/administration-access';
import { sharedPool } from '@/lib/integrations/whatsapp/shared';
import { publicSettings,currentSendingConfig } from '@/lib/communications/sendgrid/store';
import { emailCampaignReadiness } from '@/lib/marketing/email/readiness';
import { ownerTestSubject,ownerTestBody,runOwnerTest,testConfig } from '@/lib/marketing/email/owner-test';
export const dynamic='force-dynamic';export const runtime='nodejs';
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
async function access(){const s=await getServerSession(authOptions);return s?.user?.email?requireAdministrationPermission(s.user.email,'configuration.manage'):null;}
export async function GET(){
 if(!await access())return json({error:'FORBIDDEN'},403);
 try{const c=testConfig();if(!c.enabled||c.globalEnabled)return json({available:false});
  const settings=await publicSettings(),key='owner-test:'+createHash('sha256').update(c.nonce).digest('hex');
  const claimed=await sharedPool().query('SELECT 1 FROM email_campaign_events WHERE provider_event_id=$1',[key]);
  return json({available:true,claimed:!!claimed.rowCount,recipient:c.recipient,subject:ownerTestSubject,body:ownerTestBody,sender:settings.configured?settings.senderEmail:null});
 }catch{return json({error:'UNAVAILABLE'},503);}
}
export async function POST(request:Request){
 const actor=await access();if(!actor)return json({error:'FORBIDDEN'},403);
 try{if(request.headers.get('origin')!==new URL(process.env.NEXTAUTH_URL||request.url).origin)return json({error:'FORBIDDEN'},403);}catch{return json({error:'FORBIDDEN'},403);}
 try{
  const reader=request.body?.getReader();if(!reader)return json({error:'INVALID_REQUEST'},400);let size=0,body='';const decoder=new TextDecoder();for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1024){await reader.cancel();return json({error:'INVALID_REQUEST'},400);}body+=decoder.decode(part.value,{stream:true});}const data=JSON.parse(body+decoder.decode());
  if(!data||Object.keys(data).sort().join(',')!=='confirm,recipient'||data.confirm!==true||typeof data.recipient!=='string')return json({error:'INVALID_REQUEST'},400);
  const config=testConfig();if(!config.enabled||config.globalEnabled||data.recipient.trim().toLowerCase()!==config.recipient)return json({error:'TEST_NOT_ALLOWED'},403);
  if(!emailCampaignReadiness({...process.env,EMAIL_CAMPAIGNS_ENABLED:'true'}))return json({error:'TEST_NOT_READY'},409);
  const settings=await publicSettings();if(!settings.configured)return json({error:'TEST_NOT_READY'},409);
  const sender=await currentSendingConfig(settings.revision),base=process.env.NEXTAUTH_URL!;
  return json(await runOwnerTest(sharedPool(),config,data.recipient,actor.user.id,sender,base));
 }catch{return json({error:'UNKNOWN'},503);}
}
