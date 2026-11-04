import {templatePreview,listTemplates} from './templates';
/** Narrow service facade shared by both products. Mutation capability is intentionally absent. */
export async function templateWorkspaceRequest(input:unknown,catalog:typeof listTemplates=listTemplates){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_REQUEST');
 const request=input as Record<string,unknown>;
 if(Object.keys(request).some(k=>!['action','draft'].includes(k)))throw Error('INVALID_REQUEST');
 if(request.action==='preview')return templatePreview(request.draft);
 if(request.action==='list')return catalog();
 throw Error('TEMPLATE_MUTATIONS_NOT_AVAILABLE_IN_STAGE_ONE');
}
