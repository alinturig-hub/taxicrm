/** Marketing email requires an explicit current channel-specific permission. */
export type EmailEligibilityInput = { connectionEnabled:boolean; emailPermission:'granted'|'denied'|'unknown'; suppressed:boolean; unsubscribeUrl:string|null; templateAvailable:boolean };
export function emailEligibility(input:EmailEligibilityInput):'ELIGIBLE'|'CONNECTION_DISABLED'|'SUPPRESSED'|'PERMISSION_REQUIRED'|'UNSUBSCRIBE_REQUIRED'|'TEMPLATE_REQUIRED' {
 if(!input.connectionEnabled)return 'CONNECTION_DISABLED';
 if(input.suppressed)return 'SUPPRESSED';
 if(input.emailPermission!=='granted')return 'PERMISSION_REQUIRED';
 if(!input.unsubscribeUrl)return 'UNSUBSCRIBE_REQUIRED';
 try{if(new URL(input.unsubscribeUrl).protocol!=='https:')return 'UNSUBSCRIBE_REQUIRED'}catch{return 'UNSUBSCRIBE_REQUIRED'}
 if(!input.templateAvailable)return 'TEMPLATE_REQUIRED';
 return 'ELIGIBLE';
}
