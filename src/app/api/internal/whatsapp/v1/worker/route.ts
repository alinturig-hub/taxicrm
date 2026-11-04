import {dispatchPending} from '@/lib/integrations/whatsapp/dispatch';
import {workerAuthorized} from '@/lib/integrations/whatsapp/worker-auth';
import {processSharedReceipts,deliverSharedEvents} from '@/lib/integrations/whatsapp/shared-worker';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function POST(request:Request){if(!workerAuthorized(request))return Response.json({error:'UNAUTHORIZED'},{status:401});try{return Response.json({processed:await processSharedReceipts(),dispatch:await dispatchPending(),events:await deliverSharedEvents()},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'WHATSAPP_WORKER_UNAVAILABLE'},{status:503});}}
