import {templatePreview,listTemplates} from './templates';
import {isBookingTemplate} from './template-purpose';
import {submitTemplate} from './templates';
import {WhatsAppError,whatsappSettings} from './settings';
/** Shared catalog/validation; operational create is separately gated. Existing templates are never edited here. */
export async function templateWorkspaceRequest(input:unknown,catalog:typeof listTemplates=listTemplates,options:{manage?:boolean;submit?:typeof submitTemplate;env?:NodeJS.ProcessEnv}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_REQUEST');
 const request=input as Record<string,unknown>;
 if(Object.keys(request).some(k=>!['action','draft','confirmSubmission'].includes(k)))throw Error('INVALID_REQUEST');
 if(request.action==='capabilities') {
  if(Object.keys(request).length!==1)throw Error('INVALID_REQUEST');
  const settings=whatsappSettings(options.env);
  return {manage:!!options.manage&&settings.enabled&&settings.ready&&settings.templateSubmissionEnabled,inPlaceEdit:false};
 }
 if(request.action==='submit') {
  if(!options.manage)throw Error('TEMPLATE_MUTATIONS_NOT_AVAILABLE_IN_STAGE_ONE');
  if(request.confirmSubmission!==true)throw Error('INVALID_CONFIRMATION');
  const checked=templatePreview(request.draft);
  if(!isBookingTemplate(checked.payload.name)||checked.payload.category!=='UTILITY')throw new WhatsAppError('OPERATIONAL_TEMPLATE_REQUIRED',422);
  return (options.submit||submitTemplate)(request.draft);
 }
 if(request.confirmSubmission!==undefined)throw Error('INVALID_REQUEST');
 if(request.action==='preview')return templatePreview(request.draft);
 if(request.action==='list'){if(Object.keys(request).length!==1)throw Error('INVALID_REQUEST');return catalog();}
 throw Error('TEMPLATE_MUTATIONS_NOT_AVAILABLE_IN_STAGE_ONE');
}
