import { sharedPool } from '@/lib/integrations/whatsapp/shared';
import { verifyEventSignature, processEvents } from '@/lib/marketing/email/events';
export const dynamic='force-dynamic'; export const runtime='nodejs';
export async function POST(request:Request) {
 try {
  const key=process.env.SENDGRID_EVENT_PUBLIC_KEY;if(!key)return new Response(null,{status:503});
  const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});let size=0;const chunks:Uint8Array[]=[];
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>1_000_000){await reader.cancel();return new Response(null,{status:413});}chunks.push(part.value);}
  const bytes=Buffer.concat(chunks);const timestamp=request.headers.get('x-twilio-email-event-webhook-timestamp')||'',signature=request.headers.get('x-twilio-email-event-webhook-signature')||'';
  if(!verifyEventSignature(bytes,timestamp,signature,key))return new Response(null,{status:401});
  const events=JSON.parse(bytes.toString('utf8'));const processed=await processEvents(sharedPool(),events);
  // Deliberately log only aggregate counts, never addresses, payloads or signatures.
  console.info('SENDGRID_SIGNED_WEBHOOK_ACCEPTED', { received:events.length, processed });
  return new Response(null,{status:204});
 } catch { return new Response(null,{status:503}); }
}
