import {test} from "node:test";
import assert from "node:assert/strict";
import {applyBenefitEvent,benefitMarketingGate,type BenefitActivation,type BenefitEvent} from "./benefit-activation";
const state=():BenefitActivation=>({tenantId:"synthetic",customerId:"customer-1",campaignId:"campaign-1",benefitId:"benefit-1",identity:"VERIFIED_ACCOUNT",status:"PENDING",version:0,eventIds:[]});
const event=():BenefitEvent=>({id:"event-1",tenantId:"synthetic",customerId:"customer-1",campaignId:"campaign-1",benefitId:"benefit-1",version:1,status:"ACTIVE",authenticated:true});
const approved={operatorApproved:true,consent:true,suppressed:false,templateApproved:true};
test("duplicate activation is harmless and old events cannot undo revocation",()=>{
 const a=applyBenefitEvent(state(),event());assert.equal(applyBenefitEvent(a,event()),a);
 const revoked=applyBenefitEvent(a,{...event(),id:"event-2",version:2,status:"REVOKED"});
 assert.equal(applyBenefitEvent(revoked,event()).status,"REVOKED");
});
test("concurrent conflicting versions and missing events require reconciliation",()=>{
 const a=applyBenefitEvent(state(),event());assert.throws(()=>applyBenefitEvent(a,{...event(),id:"other"}),/VERSION_CONFLICT/);
 assert.throws(()=>applyBenefitEvent(state(),{...event(),version:3}),/RECONCILIATION_REQUIRED/);
});
test("foreign customer or tenant and unsigned events are rejected",()=>{
 for(const e of [{...event(),tenantId:"other"},{...event(),customerId:"other"},{...event(),authenticated:false}])assert.throws(()=>applyBenefitEvent(state(),e));
});
test("no message before activation or for unverified/shared identity",()=>{
 assert.equal(benefitMarketingGate(state(),approved),"ACTIVATION_CONFIRMATION_REQUIRED");
 for(const identity of ["UNVERIFIED","AMBIGUOUS"] as const)assert.equal(benefitMarketingGate({...state(),identity},approved),"IDENTITY_VERIFICATION_REQUIRED");
 const active=applyBenefitEvent(state(),event());assert.equal(benefitMarketingGate(active,approved),"READY_FOR_DISPATCH_REVALIDATION");
 for(const patch of [{operatorApproved:false},{consent:false},{suppressed:true},{templateApproved:false}])assert.notEqual(benefitMarketingGate(active,{...approved,...patch}),"READY_FOR_DISPATCH_REVALIDATION");
});
