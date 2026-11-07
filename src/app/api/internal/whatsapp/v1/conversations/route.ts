import {authenticate,failure} from '@/lib/integrations/whatsapp/service-http';
import {sharedPool} from '@/lib/integrations/whatsapp/shared';
import {conversationListQuery,conversationCursor} from '@/lib/integrations/whatsapp/conversation-list';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const {scope}=await authenticate(request),params=new URL(request.url).searchParams;
 if(Array.from(params.keys()).some(k=>!['q','after'].includes(k))||params.getAll('q').length>1||params.getAll('after').length>1)throw Error('INVALID_QUERY');
 const query=conversationListQuery(scope,params.get('q')||'',params.get('after')||'');
 const rows=(await sharedPool().query(query.text,query.values)).rows;
 return Response.json({conversations:rows.slice(0,50),next_cursor:rows.length>50?conversationCursor(rows[49]):null},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return failure(e)}}
