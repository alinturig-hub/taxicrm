import {authenticate,failure} from '@/lib/integrations/whatsapp/service-http';
import {acceptIntent,transaction} from '@/lib/integrations/whatsapp/shared';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:Request){try{const {body,scope}=await authenticate(request);let input;try{input=JSON.parse(body);}catch{throw Error('INVALID_JSON');}const result=await transaction(db=>acceptIntent(db,scope,input));return Response.json(result,{status:202,headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
