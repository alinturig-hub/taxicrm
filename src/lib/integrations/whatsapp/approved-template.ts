import {whatsappCredentials,WhatsAppError} from './settings';
import {boundedJson} from './templates';
/** Approval is fetched from Meta immediately before dispatch, never inferred from operator input. */
export async function approvedServiceTemplate(name:string,language:string,count:number,env:NodeJS.ProcessEnv=process.env,fetcher:typeof fetch=fetch){
 if(!/^[a-z0-9_]{1,512}$/.test(name)||!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language))throw Error('INVALID_TEMPLATE_BINDING');
 const c=whatsappCredentials(env),url=new URL(`https://graph.facebook.com/${c.graphVersion}/${c.wabaId}/message_templates`);url.searchParams.set('name',name);url.searchParams.set('fields','id,name,status,category,language,components');url.searchParams.set('limit','25');
 let payload:Record<string,unknown>;try{const r=await fetcher(url,{headers:{Authorization:`Bearer ${c.accessToken}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();payload=await boundedJson(r);}catch{throw new WhatsAppError('TEMPLATE_APPROVAL_UNAVAILABLE',503);}
 const matches=(Array.isArray(payload.data)?payload.data:[]).filter((t:Record<string,unknown>)=>t.name===name&&t.language===language);if(matches.length!==1)throw Error('APPROVED_TEMPLATE_REQUIRED');const t=matches[0];
 if(t.status!=='APPROVED'||t.category!=='UTILITY'||!Array.isArray(t.components))throw Error('APPROVED_UTILITY_TEMPLATE_REQUIRED');
 const bodies=t.components.filter((v:Record<string,unknown>)=>v.type==='BODY');
 // Only text body templates are supported; header media/buttons need a separate payload adapter.
 if(bodies.length!==1||typeof bodies[0].text!=='string'||t.components.some((v:Record<string,unknown>)=>v.type!=='BODY'&&v.type!=='FOOTER'))throw Error('UNSUPPORTED_TEMPLATE_COMPONENTS');
 const body=bodies[0].text as string,indexes=Array.from(new Set(Array.from(body.matchAll(/\{\{([1-9]\d*)\}\}/g)).map(m=>Number(m[1])))).sort((a,b)=>a-b);
 if(/[{}]/.test(body.replace(/\{\{([1-9]\d*)\}\}/g,''))||indexes.length!==count||indexes.some((v,i)=>v!==i+1))throw Error('TEMPLATE_PARAMETERS_MISMATCH');
 return {name,language,body,metaId:String(t.id)};
}
