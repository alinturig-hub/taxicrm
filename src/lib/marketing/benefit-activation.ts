/** Integration boundary only. No grant, booking write or message dispatch. */
export type BenefitActivation = {
 tenantId:string; customerId:string; campaignId:string; benefitId:string;
 identity:"VERIFIED_ACCOUNT"|"VERIFIED_PHONE"|"UNVERIFIED"|"AMBIGUOUS";
 status:"PENDING"|"ACTIVE"|"REFUSED"|"REVOKED"|"EXPIRED";
 version:number; eventIds:string[];
};
export type BenefitEvent = {id:string; tenantId:string; customerId:string; campaignId:string; benefitId:string; version:number; status:BenefitActivation["status"]; authenticated:boolean};
export function applyBenefitEvent(state:BenefitActivation,event:BenefitEvent):BenefitActivation{
 if(!event.authenticated)throw Error("UNAUTHENTICATED_EVENT");
 if(!event.id.trim()||!Number.isSafeInteger(event.version)||event.version<1)throw Error("INVALID_EVENT");
 if(!["PENDING","ACTIVE","REFUSED","REVOKED","EXPIRED"].includes(event.status))throw Error("INVALID_STATUS");
 for(const key of ["tenantId","customerId","campaignId","benefitId"] as const)
 if(!state[key].trim()||state[key]!==event[key])throw Error("IDENTITY_MISMATCH");
 if(state.eventIds.includes(event.id)||event.version<state.version)return state;
 if(event.version===state.version)throw Error("VERSION_CONFLICT");
 if(event.version!==state.version+1)throw Error("RECONCILIATION_REQUIRED");
 return {...state,status:event.status,version:event.version,eventIds:[...state.eventIds,event.id]};
}
export function benefitMarketingGate(state:BenefitActivation,input:{operatorApproved:boolean;consent:boolean;suppressed:boolean;templateApproved:boolean}){
 if(state.identity!=="VERIFIED_ACCOUNT"&&state.identity!=="VERIFIED_PHONE")return "IDENTITY_VERIFICATION_REQUIRED";
 if(!input.operatorApproved)return "OPERATOR_APPROVAL_REQUIRED";
 if(state.status!=="ACTIVE")return "ACTIVATION_CONFIRMATION_REQUIRED";
 if(!input.consent)return "MARKETING_CONSENT_REQUIRED";
 if(input.suppressed)return "CONTACT_SUPPRESSED";
 if(!input.templateApproved)return "APPROVED_TEMPLATE_REQUIRED";
 return "READY_FOR_DISPATCH_REVALIDATION";
}
