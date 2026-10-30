import { createHash } from "node:crypto";
import { sendEligibility } from "./eligibility";
export type VoucherCampaignInput = {
 workspaceKey:string; campaignId:string; connectionId:string; provider:"META"|"COMBOT";
 customer:{workspaceKey:string; id:string; nacCustomerId:string; phone:string; name:string; consent:boolean; suppressed:boolean};
 assignment:{workspaceKey:string; id:string; customerId:string; voucherId:string; code:string; status:"ASSIGNED"|"REVOKED"; validFrom:string; validUntil:string};
 template:{workspaceKey:string; name:string; language:string; status:string};
 now:Date;
};
/** Pure proposal-contract planner. It performs no assignment, reservation or delivery. */
export function planVoucherCampaign(input:VoucherCampaignInput){
 const {customer,assignment,template}=input;
 if(!input.workspaceKey.trim()||[customer,assignment,template].some(x=>x.workspaceKey!==input.workspaceKey))throw Error("WORKSPACE_MISMATCH");
 if(!input.campaignId.trim()||!input.connectionId.trim()||!customer.id.trim()||!customer.nacCustomerId.trim()||assignment.customerId!==customer.nacCustomerId)throw Error("CUSTOMER_MAPPING_REQUIRED");
 if(!assignment.id.trim()||!assignment.voucherId.trim()||!assignment.code.trim()||assignment.status!=="ASSIGNED")throw Error("CONFIRMED_ASSIGNMENT_REQUIRED");
 const from=Date.parse(assignment.validFrom),until=Date.parse(assignment.validUntil),now=input.now.getTime();
 if(!Number.isFinite(from)||!Number.isFinite(until)||!Number.isFinite(now)||until<=from||now<from||now>=until)throw Error("VOUCHER_NOT_VALID");
 if(!/^\+[1-9]\d{7,14}$/.test(customer.phone)|| !/^[a-z0-9_]{1,512}$/.test(template.name)|| !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(template.language))throw Error("INVALID_MESSAGE_FIELDS");
 if([customer.name,assignment.code].some(x=>!x.trim()||x.length>200||/[\r\n\x00-\x1f]/.test(x)))throw Error("INVALID_TEMPLATE_VARIABLES");
 if(input.provider!=="META"&&input.provider!=="COMBOT")throw Error("INVALID_PROVIDER");
 const eligibility=sendEligibility({enabled:true,consent:customer.consent,suppressed:customer.suppressed,approvedTemplate:template.status==="APPROVED",lastInboundAt:null,now:input.now,kind:"MARKETING"});
 if(eligibility!=="ELIGIBLE")throw Error(eligibility);
 const idempotencyKey=createHash("sha256").update(JSON.stringify([input.workspaceKey,input.campaignId,customer.id,assignment.id])).digest("hex");
 return {mode:"PREVIEW_ONLY" as const,provider:input.provider,connectionId:input.connectionId,idempotencyKey,assignmentId:assignment.id,
 payload:{messaging_product:"whatsapp",to:customer.phone.slice(1),type:"template",template:{name:template.name,language:{code:template.language},components:[{type:"body",parameters:[customer.name,assignment.code].map(text=>({type:"text",text}))}]}},
 notice:"Synthetic contract preview only. Runtime must revalidate assignment, consent, provider readiness and suppression before dispatch."};
}
