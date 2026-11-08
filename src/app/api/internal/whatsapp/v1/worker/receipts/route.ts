import {workerAuthorized} from '@/lib/integrations/whatsapp/worker-auth';
import {processFastReceipts} from '@/lib/integrations/whatsapp/shared-worker';
export const dynamic='force-dynamic';export const runtime='nodejs';
export async function POST(request:Request){
 if(!workerAuthorized(request))return Response.json({error:'UNAUTHORIZED'},{status:401});
 if(process.env.WHATSAPP_RECEIPT_FAST_ENABLED!=='true')return Response.json({error:'DISABLED'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await processFastReceipts(),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'WHATSAPP_RECEIPTS_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
