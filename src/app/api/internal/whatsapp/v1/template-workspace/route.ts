import {authenticate,failure} from '@/lib/integrations/whatsapp/service-http';
import {templateWorkspaceRequest} from '@/lib/integrations/whatsapp/template-workspace';
export const runtime='nodejs';export const dynamic='force-dynamic';
/** Shared validation/catalog facade. No Meta mutation methods in stage one. */
export async function POST(request:Request){try{
 if(process.env.WHATSAPP_TEMPLATE_WORKSPACE_ENABLED!=='true')throw Error('WHATSAPP_SERVICE_NOT_CONFIGURED');
 const {body}=await authenticate(request);const input=JSON.parse(body);

 if(!['preview','list'].includes(input?.action))return Response.json({error:'TEMPLATE_MUTATIONS_NOT_AVAILABLE_IN_STAGE_ONE'},{status:409,headers:{'Cache-Control':'no-store'}});
 return Response.json(await templateWorkspaceRequest(input),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return failure(e)}}
