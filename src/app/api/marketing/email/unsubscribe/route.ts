import { NextResponse } from 'next/server';
import { sharedPool } from '@/lib/integrations/whatsapp/shared';
import { unsubscribe } from '@/lib/marketing/email/unsubscribe';
export const dynamic='force-dynamic'; export const runtime='nodejs';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
// Mail scanners often follow links. GET has no side effects; a form POST records the request.
export async function GET(request:Request) {
 const token=new URL(request.url).searchParams.get('token')||'';
 if(!/^[A-Za-z0-9._-]{1,150}$/.test(token)) return new Response('Invalid link.',{status:400,headers});
 const safe=token.replace(/[&<>"']/g,'');
 return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body><main><h1>Unsubscribe from marketing emails</h1><p>Confirm to stop receiving marketing emails.</p><form method="post"><input type="hidden" name="token" value="${safe}"><button type="submit">Unsubscribe</button></form></main></body></html>`,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
}
export async function POST(request:Request) {
 try {
  const body=await request.text(); if(body.length>512) return NextResponse.json({error:'Invalid request'},{status:400,headers});
  const params=new URLSearchParams(body); const token=params.get('token')||new URL(request.url).searchParams.get('token')||'';
  if(!await unsubscribe(sharedPool(),token)) return NextResponse.json({error:'Invalid link'},{status:400,headers});
  return new Response('You have been unsubscribed from marketing emails.',{headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
 } catch { return new Response('Unable to process your request. Please contact the business.',{status:503,headers}); }
}
