import {boundedBody,verifyService} from './service-auth';
import {sharedPool,sharedScope} from './shared';
export async function authenticate(request:Request){
 if(process.env.WHATSAPP_SHARED_ENABLED!=='true')throw Error('WHATSAPP_SERVICE_NOT_CONFIGURED');
 const body=await boundedBody(request),scope=sharedScope();
 await verifyService(request,body,process.env.WHATSAPP_NAC_KEY_ID||'',process.env.WHATSAPP_NAC_SECRET||'',async id=>{
 const row=await sharedPool().query(`INSERT INTO "WhatsAppServiceNonce" (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`,[id]);return !!row.rowCount;});return {body,scope};
}
export function failure(e:unknown){const code=e instanceof Error?e.message:'UNAVAILABLE';const status=code==='UNAUTHORIZED'||code==='REPLAY'?401:code==='WRONG_SCOPE'?403:code==='NOT_FOUND'?404:code.includes('CONFLICT')?409:code.startsWith('INVALID')?422:code==='BODY_TOO_LARGE'?413:503;return Response.json({error:status===503?'WHATSAPP_UNAVAILABLE':code},{status,headers:{'Cache-Control':'no-store'}});}

/** Dedicated binary media path; normal JSON service requests retain their 32 KiB bound. */
export async function authenticateTemplateMedia(request:Request){
 if(process.env.WHATSAPP_SHARED_ENABLED!=='true')throw Error('WHATSAPP_SERVICE_NOT_CONFIGURED');
 const {templateMediaBody}=await import('./template-media-body');
 const body=await templateMediaBody(request),scope=sharedScope();
 await verifyService(request,body,process.env.WHATSAPP_NAC_KEY_ID||'',process.env.WHATSAPP_NAC_SECRET||'',async id=>{
 const row=await sharedPool().query(`INSERT INTO "WhatsAppServiceNonce" (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`,[id]);return !!row.rowCount;});return {body,scope};
}
