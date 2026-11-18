import { timingSafeEqual } from 'node:crypto';
import { sharedPool } from '@/lib/integrations/whatsapp/shared';
import { currentSendingConfig, publicSettings } from '@/lib/communications/sendgrid/store';
import { dispatchOne, expireClaims, finishSettledCampaigns } from '@/lib/marketing/email/dispatch';
import { emailCampaignReadiness } from '@/lib/marketing/email/readiness';
export const dynamic='force-dynamic';export const runtime='nodejs';
let running=false;
export async function POST(request:Request) {
 const configured=process.env.EMAIL_WORKER_SECRET||'',given=request.headers.get('x-email-worker-secret')||'';
 if(!emailCampaignReadiness()||configured.length<32||Buffer.byteLength(configured)!==Buffer.byteLength(given)||!timingSafeEqual(Buffer.from(configured),Buffer.from(given)))return new Response(null,{status:403});
 if(running)return new Response(null,{status:429});running=true;
 try{
  const settings=await publicSettings();if(!settings.configured)return new Response(null,{status:503});
  const sender=await currentSendingConfig(settings.revision);const base=process.env.NEXTAUTH_URL;if(!base||!process.env.SENDGRID_EVENT_PUBLIC_KEY)return new Response(null,{status:503});
  const pool=sharedPool();await expireClaims(pool);const result=await dispatchOne(pool,sender,base);await finishSettledCampaigns(pool);
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return new Response(null,{status:503});}finally{running=false;}
}
