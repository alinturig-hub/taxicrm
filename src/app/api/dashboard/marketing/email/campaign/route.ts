import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { requireAdministrationPermission } from '@/lib/administration-access';
import { sharedPool } from '@/lib/integrations/whatsapp/shared';
import { randomUUID } from 'node:crypto';
import { emailCampaignReadiness } from '@/lib/marketing/email/readiness';
import { publicSettings, selectSendgridSender } from '@/lib/communications/sendgrid/store';
export const dynamic='force-dynamic';export const runtime='nodejs';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request) {
 const session=await getServerSession(authOptions),actor=session?.user?.email?await requireAdministrationPermission(session.user.email,'customers.manage'):null;
 if(!actor)return reply({error:'FORBIDDEN'},403);
 try{if(request.headers.get('origin')!==new URL(process.env.NEXTAUTH_URL||request.url).origin)return reply({error:'FORBIDDEN'},403);}catch{return reply({error:'FORBIDDEN'},403);}
 try {
  if(Number(request.headers.get('content-length')||0)>4096)return reply({error:'INVALID_REQUEST'},400);
  const reader=request.body?.getReader();if(!reader)return reply({error:'INVALID_REQUEST'},400);let bytes=0,text='';const decoder=new TextDecoder();for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>4096){await reader.cancel();return reply({error:'INVALID_REQUEST'},400);}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();const data=JSON.parse(text);
  if(!data||Object.keys(data).sort().join(',')!=='action,confirm,id'||data.confirm!==true||typeof data.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)||!['activate','pause','cancel'].includes(data.action))return reply({error:'INVALID_REQUEST'},400);
  const activating = data.action === 'activate';
  if (activating && !emailCampaignReadiness()) return reply({error:'SENDING_NOT_READY'},409);
  const senderSettings = activating ? await publicSettings() : null;
  if (activating && !senderSettings?.configured) return reply({error:'SENDING_NOT_READY'},409);
  const client=await sharedPool().connect();try{
   await client.query('BEGIN');
   const campaign=await client.query('SELECT status,schedule_at,sender_email,sender_name FROM email_campaigns WHERE id=$1 FOR UPDATE',[data.id]);
   if(!campaign.rows.length){await client.query('ROLLBACK');return reply({error:'NOT_FOUND'},404);}
   if(data.action==='activate'&&(await client.query("SELECT 1 FROM email_campaign_events WHERE campaign_id=$1 AND event_type='OWNER_TEST_CLAIMED'",[data.id])).rowCount){await client.query('ROLLBACK');return reply({error:'INVALID_STATE'},409);}
   const current=campaign.rows[0], valid=data.action==='activate'?['DRAFT','PAUSED'].includes(current.status)&&current.schedule_at&&new Date(current.schedule_at).getTime()>Date.now():data.action==='pause'?current.status==='SCHEDULED':['DRAFT','SCHEDULED','PAUSED'].includes(current.status);
   if(!valid){await client.query('ROLLBACK');return reply({error:'INVALID_STATE'},409);}
   if (senderSettings) {
    const selected = selectSendgridSender(senderSettings, current.sender_email);
    if (selected?.senderEmail !== current.sender_email || selected?.senderName !== current.sender_name) {
     await client.query('ROLLBACK');
     return reply({error:'SENDER_NOT_CONFIGURED'},409);
    }
   }
   const status=data.action==='activate'?'SCHEDULED':data.action==='pause'?'PAUSED':'CANCELLED';
   await client.query('UPDATE email_campaigns SET status=$2,updated_at=now() WHERE id=$1',[data.id,status]);
   await client.query('INSERT INTO email_campaign_events(id,campaign_id,event_type) VALUES($1,$2,$3)',[randomUUID(),data.id,`${status}:${actor.user.id}`]);
   await client.query('COMMIT');return reply({status});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }catch{return reply({error:'UNAVAILABLE'},503);}
}
