import {test} from "node:test";import assert from "node:assert/strict";
import {promotionMeasurement,promotionTrackingUrl} from "./promotion-measurement";
test("completed-only margin preserves negative differences and does not deduct discount twice",()=>{
 const r=promotionMeasurement({promotionCustomers:["a"],controlCustomers:["b"],campaignSpendPence:50,outcomes:[{customerId:"a",arm:"PROMOTION",status:"COMPLETED",pricePence:1710,costPence:1900},{customerId:"a",arm:"PROMOTION",status:"CANCELLED",pricePence:9999,costPence:0},{customerId:"b",arm:"CONTROL",status:"COMPLETED",pricePence:1000,costPence:900}]});assert.equal(r.promotion.observedMarginPence,-190);assert.equal(r.incrementalContributionPence,-340);assert.equal(r.promotion.completed,1);
});
test("no control missing money or zero spend never invent returns",()=>{
 const base={promotionCustomers:["a"],controlCustomers:[],campaignSpendPence:0,outcomes:[]};assert.equal(promotionMeasurement(base).incrementalMarginPence,null);assert.equal(promotionMeasurement(base).returnOnCampaignSpend,null);
 assert.equal(promotionMeasurement({...base,controlCustomers:["b"],outcomes:[{customerId:"a",arm:"PROMOTION",status:"COMPLETED",pricePence:null,costPence:0}]}).incrementalMarginPence,null);
});
test("overlapping cohorts rejected; UTM preserves existing parameters",()=>{
 assert.throws(()=>promotionMeasurement({promotionCustomers:["a"],controlCustomers:["a"],outcomes:[],campaignSpendPence:0}));const u=new URL(promotionTrackingUrl("https://example.test/book?service=asap","synthetic-campaign","synthetic-template"));assert.equal(u.searchParams.get("service"),"asap");assert.equal(u.searchParams.get("utm_source"),"whatsapp");
});
