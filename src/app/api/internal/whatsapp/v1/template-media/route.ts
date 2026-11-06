import {authenticateTemplateMedia,failure} from '@/lib/integrations/whatsapp/service-http';
import {uploadTemplateMedia} from '@/lib/integrations/whatsapp/template-upload';
import {reserveWhatsAppList} from '@/lib/integrations/whatsapp/limit';
import {WhatsAppError} from '@/lib/integrations/whatsapp/settings';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){let release:(()=>void)|undefined;try{
 if(process.env.WHATSAPP_TEMPLATE_WORKSPACE_ENABLED!=='true'||process.env.WHATSAPP_OPERATIONAL_TEMPLATE_MANAGEMENT_ENABLED!=='true')throw Error('WHATSAPP_SERVICE_NOT_CONFIGURED');
 const {body}=await authenticateTemplateMedia(request);release=reserveWhatsAppList('operational-template-media');
 return Response.json(await uploadTemplateMedia(body),{headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof WhatsAppError)return Response.json({error:e.code},{status:e.status,headers:{'Cache-Control':'no-store'}});return failure(e)}finally{release?.()}}
