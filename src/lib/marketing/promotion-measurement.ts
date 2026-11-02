export type PromotionOutcome = {customerId:string; arm:"PROMOTION"|"CONTROL";status:string;pricePence:number|null;costPence:number|null};
/** Cohorts must be assigned before exposure. Discount already reflected in Price is not subtracted again. */
export function promotionMeasurement(input:{promotionCustomers:string[];controlCustomers:string[];outcomes:PromotionOutcome[];campaignSpendPence:number}){
 const p=new Set(input.promotionCustomers),c=new Set(input.controlCustomers);
 if(p.size!==input.promotionCustomers.length||c.size!==input.controlCustomers.length||Array.from(p).some(id=>c.has(id)))throw Error("INVALID_COHORTS");
 if(!Number.isSafeInteger(input.campaignSpendPence)||input.campaignSpendPence<0)throw Error("INVALID_SPEND");
 const groups={PROMOTION:{completed:0,customers:new Set<string>(),margin:0,missing:0},CONTROL:{completed:0,customers:new Set<string>(),margin:0,missing:0}};
 for(const o of input.outcomes){
 if(o.arm!=="PROMOTION"&&o.arm!=="CONTROL")throw Error("INVALID_ARM");
 if(!(o.arm==="PROMOTION"?p:c).has(o.customerId))throw Error("OUTCOME_OUTSIDE_COHORT");
 if(o.status!=="COMPLETED")continue;
 const g=groups[o.arm];g.completed++;g.customers.add(o.customerId);
 if(o.pricePence===null||o.costPence===null){g.missing++;continue;}
 if(!Number.isSafeInteger(o.pricePence)||!Number.isSafeInteger(o.costPence))throw Error("INVALID_MONEY");
 g.margin+=o.pricePence-o.costPence;
 }
 const treatment=groups.PROMOTION,control=groups.CONTROL;
 const comparable=p.size>0&&c.size>0;
 const completeMoney=!treatment.missing&&!control.missing;
 const incrementalMarginPence=comparable&&completeMoney?treatment.margin-control.margin/c.size*p.size:null;
 const incrementalContributionPence=incrementalMarginPence===null?null:incrementalMarginPence-input.campaignSpendPence;
 return {promotion:{eligible:p.size,converted:treatment.customers.size,completed:treatment.completed,observedMarginPence:treatment.margin,missingMoney:treatment.missing},control:{eligible:c.size,converted:control.customers.size,completed:control.completed,observedMarginPence:control.margin,missingMoney:control.missing},conversionLift:comparable?treatment.customers.size/p.size-control.customers.size/c.size:null,incrementalMarginPence,incrementalContributionPence,returnOnCampaignSpend:input.campaignSpendPence>0&&incrementalContributionPence!==null?incrementalContributionPence/input.campaignSpendPence:null,methodology:"Per-customer control comparison; requires preassigned comparable cohorts and a common observation window. Not net company profit or proof of causality."};
}
export function promotionTrackingUrl(base:string,campaignId:string,templateId:string){
 const url=new URL(base);
 if(url.protocol!=="https:"||url.username||url.password||!campaignId.trim()||!templateId.trim())throw Error("INVALID_TRACKING_LINK");
 url.searchParams.set("utm_source","whatsapp");url.searchParams.set("utm_medium","messaging");url.searchParams.set("utm_campaign",campaignId);url.searchParams.set("utm_content",templateId);
 return url.href;
}
