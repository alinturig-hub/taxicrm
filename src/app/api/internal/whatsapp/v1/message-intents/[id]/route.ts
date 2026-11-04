import {authenticate,failure} from '@/lib/integrations/whatsapp/service-http';
import {sharedPool} from '@/lib/integrations/whatsapp/shared';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:{id:string}}){try{const {scope}=await authenticate(request);const row=(await sharedPool().query(`SELECT id,status,"conversationId" AS conversation_id FROM "WhatsAppServiceIntent" WHERE scope=$1 AND id=$2`,[scope,params.id])).rows[0];if(!row)throw Error('NOT_FOUND');return Response.json(row,{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
