import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { requireAdministrationPermission } from '@/lib/administration-access';
import { sharedPool } from '@/lib/integrations/whatsapp/shared';
import { publicSettings } from '@/lib/communications/sendgrid/store';
import { saveCampaign, saveTemplate, DraftError } from '@/lib/marketing/email/drafts';
export const dynamic='force-dynamic'; export const runtime='nodejs';
const result=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function access() { const session=await getServerSession(authOptions); return session?.user?.email ? requireAdministrationPermission(session.user.email,'customers.manage') : null; }
export async function GET() {
 if (!await access()) return result({error:'FORBIDDEN'},403);
 try { const db=sharedPool(); const [templates,campaigns,sender]=await Promise.all([db.query('SELECT id,name,subject,body,updated_at FROM email_templates ORDER BY updated_at DESC LIMIT 100'),db.query('SELECT id,name,status,sender_email,schedule_at,created_at FROM email_campaigns ORDER BY created_at DESC LIMIT 100'),publicSettings()]); return result({templates:templates.rows,campaigns:campaigns.rows,sender}); }
 catch { return result({error:'UNAVAILABLE'},503); }
}
export async function POST(req:Request) {
 const actor=await access(); if (!actor) return result({error:'FORBIDDEN'},403);
 try { if(req.headers.get('origin')!==new URL(process.env.NEXTAUTH_URL||req.url).origin) return result({error:'FORBIDDEN'},403); } catch { return result({error:'FORBIDDEN'},403); }
 try {
  const reader=req.body?.getReader(); if(!reader) return result({error:'INVALID_REQUEST'},400);
  let size=0, payload='', decoder=new TextDecoder(); for (;;) { const part=await reader.read(); if(part.done) break; size+=part.value.byteLength; if(size>2100000) { await reader.cancel(); return result({error:'TOO_LARGE'},413); } payload+=decoder.decode(part.value,{stream:true}); } payload+=decoder.decode();
  const input=JSON.parse(payload); if(!input || typeof input!=='object' || Array.isArray(input)) return result({error:'INVALID_REQUEST'},400);
  const {kind,...data}=input; if(kind==='template') return result(await saveTemplate(sharedPool(),data,actor.user.id),201);
  if(kind==='campaign') { const sender=await publicSettings(); if(!sender.configured || !sender.senderEmail || !sender.senderName) return result({error:'SENDER_NOT_CONFIGURED'},400); return result(await saveCampaign(sharedPool(),data,actor.user.id,{senderEmail:sender.senderEmail,senderName:sender.senderName}),201); }
  return result({error:'INVALID_REQUEST'},400);
 } catch(e) { if(e instanceof DraftError || e instanceof SyntaxError || (e instanceof Error && /CSV/.test(e.message))) return result({error:'INVALID_REQUEST'},400); return result({error:'UNAVAILABLE'},503); }
}
