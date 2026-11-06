import {authenticate,failure} from '@/lib/integrations/whatsapp/service-http';
import {reserveWhatsAppList} from '@/lib/integrations/whatsapp/limit';
import {WhatsAppError} from '@/lib/integrations/whatsapp/settings';
import {templateWorkspaceRequest} from '@/lib/integrations/whatsapp/template-workspace';
export const runtime='nodejs';export const dynamic='force-dynamic';
/** All Meta mutations remain in TaxiCRM; the authenticated caller is NeedACab Plus. */
export async function POST(request:Request){let release:(()=>void)|undefined;try{
 if(process.env.WHATSAPP_TEMPLATE_WORKSPACE_ENABLED!=='true')throw Error('WHATSAPP_SERVICE_NOT_CONFIGURED');
 const {body}=await authenticate(request);const input=JSON.parse(body);
 if(['list','submit'].includes(input?.action))release=reserveWhatsAppList('operational-template-workspace');
 return Response.json(await templateWorkspaceRequest(input,undefined,{manage:process.env.WHATSAPP_OPERATIONAL_TEMPLATE_MANAGEMENT_ENABLED==='true'}),{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof WhatsAppError)return Response.json({error:e.code},{status:e.status,headers:{'Cache-Control':'no-store'}});return failure(e)}finally{release?.()}}
