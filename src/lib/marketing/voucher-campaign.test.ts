import {test} from "node:test";
import assert from "node:assert/strict";
import {planVoucherCampaign,type VoucherCampaignInput} from "./voucher-campaign";
const fixture=():VoucherCampaignInput=>({workspaceKey:"synthetic",campaignId:"campaign-1",connectionId:"connection-1",provider:"COMBOT",customer:{workspaceKey:"synthetic",id:"crm-1",nacCustomerId:"nac-1",phone:"+447700900123",name:"Synthetic Rider",consent:true,suppressed:false},assignment:{workspaceKey:"synthetic",id:"assignment-1",customerId:"nac-1",voucherId:"voucher-1",code:"SYNTHETIC10",status:"ASSIGNED",validFrom:"2026-10-01T00:00:00Z",validUntil:"2026-11-01T00:00:00Z"},template:{workspaceKey:"synthetic",name:"voucher_offer",language:"en_GB",status:"APPROVED"},now:new Date("2026-10-30T12:00:00Z")});
test("both transports receive a template plan, never a send",()=>{
 for(const provider of ["META","COMBOT"] as const){const i=fixture();i.provider=provider;const p=planVoucherCampaign(i);assert.equal(p.mode,"PREVIEW_ONLY");assert.equal(p.payload.template.components[0].parameters[1].text,"SYNTHETIC10");}
});
test("retries retain stable identity and do not encode contact details in key",()=>{
 const i=fixture(),a=planVoucherCampaign(i);assert.equal(a.idempotencyKey,planVoucherCampaign(i).idempotencyKey);assert.match(a.idempotencyKey,/^[a-f0-9]{64}$/);
 i.campaignId="campaign-2";assert.notEqual(a.idempotencyKey,planVoucherCampaign(i).idempotencyKey);
});
test("tenant mismatch and unverified customer mapping fail",()=>{
 const i=fixture();i.assignment.workspaceKey="other";assert.throws(()=>planVoucherCampaign(i),/WORKSPACE_MISMATCH/);
 i.assignment.workspaceKey="synthetic";i.assignment.customerId="other";assert.throws(()=>planVoucherCampaign(i),/CUSTOMER_MAPPING_REQUIRED/);
});
test("consent, opt-out, template approval and revocation are enforced",()=>{
 for(const mutate of [(i:VoucherCampaignInput)=>{i.customer.consent=false},(i:VoucherCampaignInput)=>{i.customer.suppressed=true},(i:VoucherCampaignInput)=>{i.template.status="PENDING"},(i:VoucherCampaignInput)=>{i.assignment.status="REVOKED"}]){const i=fixture();mutate(i);assert.throws(()=>planVoucherCampaign(i));}
});
test("expiry is exclusive and invalid timestamps or line breaks fail",()=>{
 const i=fixture();i.now=new Date(i.assignment.validUntil);assert.throws(()=>planVoucherCampaign(i),/VOUCHER_NOT_VALID/);
 i.now=new Date("invalid");assert.throws(()=>planVoucherCampaign(i));
 const j=fixture();j.assignment.code="CODE\nINJECT";assert.throws(()=>planVoucherCampaign(j),/INVALID_TEMPLATE_VARIABLES/);
});
