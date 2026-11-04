import {whatsappAccess,whatsappBody,whatsappOrigin} from '@/lib/integrations/whatsapp/access';
import {sharedScope,sharedPool,transaction} from '@/lib/integrations/whatsapp/shared';
import {saveBinding,saveGrant} from '@/lib/integrations/whatsapp/policy';
import {failure} from '@/lib/integrations/whatsapp/service-http';
import {WhatsAppError} from '@/lib/integrations/whatsapp/settings';
export const dynamic='force-dynamic';
function ready(){if(process.env.WHATSAPP_SHARED_ENABLED!=='true')throw Error('WHATSAPP_SERVICE_NOT_CONFIGURED');return sharedScope();}
function error(e:unknown){return e instanceof WhatsAppError?Response.json({error:e.code},{status:e.status}):failure(e);}
export async function GET(){try{await whatsappAccess();const scope=ready();const bindings=(await sharedPool().query(`SELECT milestone,name,language,"parameterKeys",enabled FROM "WhatsAppTemplateBinding" WHERE scope=$1 ORDER BY milestone`,[scope])).rows;const held=(await sharedPool().query(`SELECT status,"lastReason",count(*)::int AS count FROM "WhatsAppServiceIntent" WHERE scope=$1 GROUP BY status,"lastReason"`,[scope])).rows;return Response.json({bindings,intents:held,sending_enabled:process.env.WHATSAPP_JOURNEY_SENDING_ENABLED==='true'&&process.env.META_WHATSAPP_SENDING_ENABLED==='true'},{headers:{'Cache-Control':'no-store'}});}catch(e){return error(e);}}
export async function POST(request:Request){try{const access=await whatsappAccess(true);whatsappOrigin(request);const scope=ready(),body=await whatsappBody(request);const result=await transaction(async db=>{if(body.type==='binding')return saveBinding(db,scope,body,access.user.id);if(body.type==='grant')return saveGrant(db,scope,body,access.user.id);throw Error('INVALID_POLICY_COMMAND');});return Response.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){return error(e);}}
