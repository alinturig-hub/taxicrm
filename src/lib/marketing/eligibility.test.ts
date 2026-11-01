import { test } from "node:test";
import assert from "node:assert/strict";
import { sendEligibility, type SendEligibility } from "./eligibility";
const base: SendEligibility = {enabled:true, consent:true, suppressed:false, approvedTemplate:true, lastInboundAt:null, now:new Date("2026-10-28T12:00:00Z"), kind:"MARKETING"};
test("marketing needs explicit consent and approved template",()=>{
 assert.equal(sendEligibility({...base,consent:false}),"CONSENT_REQUIRED");
 assert.equal(sendEligibility({...base,approvedTemplate:false,lastInboundAt:base.now}),"APPROVED_TEMPLATE_REQUIRED");
 assert.equal(sendEligibility(base),"ELIGIBLE");
});
test("suppression overrides consent and queued approval",()=>{
 assert.equal(sendEligibility({...base,suppressed:true}),"CONTACT_SUPPRESSED");
 assert.equal(sendEligibility({...base,enabled:false}),"CONNECTION_DISABLED");
});
test("service window excludes exactly 24 hours and future inbound timestamps",()=>{
 const service = {...base,kind:"SERVICE" as const,approvedTemplate:false};
 assert.equal(sendEligibility({...service,lastInboundAt:new Date("2026-10-27T12:00:01Z")}),"ELIGIBLE");
 for(const time of ["2026-10-27T12:00:00Z","2026-10-28T12:00:01Z"])
 assert.equal(sendEligibility({...service,lastInboundAt:new Date(time)}),"APPROVED_TEMPLATE_REQUIRED");
});
