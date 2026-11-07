import {whatsappAccess,privateHeaders} from '@/lib/integrations/whatsapp/access';
import {sharedPool,sharedScope} from '@/lib/integrations/whatsapp/shared';
import {marketingHistoryQuery,marketingHistoryCursor} from '@/lib/integrations/whatsapp/marketing-history';
import {WhatsAppError} from '@/lib/integrations/whatsapp/settings';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 await whatsappAccess();if(process.env.WHATSAPP_SHARED_ENABLED!=='true')throw Error('UNAVAILABLE');
 const params=new URL(request.url).searchParams;if(Array.from(params.keys()).some(k=>k!=='cursor')||params.getAll('cursor').length>1||(params.get('cursor')||'').length>512)return Response.json({error:'INVALID_CURSOR'},{status:400,headers:privateHeaders});
 const query=marketingHistoryQuery(sharedScope(),params.get('cursor')||'');const rows=(await sharedPool().query(query.text,query.values)).rows;
 const items=rows.slice(0,50).map(r=>({id:r.id,recipient:r.recipient,createdAt:r.createdAt,status:r.messageStatus||r.outboxStatus,templateName:r.templateName||null,messageText:r.messageText||null,messageTruncated:r.messageTruncated===true}));
 return Response.json({items,nextCursor:rows.length>50?marketingHistoryCursor(rows[49]):null},{headers:privateHeaders});
 }catch(e){if(e instanceof WhatsAppError)return Response.json({error:e.code},{status:e.status,headers:privateHeaders});if(e instanceof Error&&e.message==='INVALID_CURSOR')return Response.json({error:'INVALID_CURSOR'},{status:400,headers:privateHeaders});return Response.json({error:'HISTORY_UNAVAILABLE'},{status:503,headers:privateHeaders})}}
