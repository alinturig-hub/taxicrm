import {test} from "node:test";import assert from "node:assert/strict";import {projectInbox} from "./inbox-projection";
const envelope=(value:unknown,waba="123456789")=>JSON.stringify({entry:[{id:waba,changes:[{field:"messages",value:{metadata:{phone_number_id:"business-1"},...value as object}}]}]});
test("same message in multiple delivery envelopes is shown once",()=>{const raw=envelope({messages:[{id:"m1",from:"synthetic",timestamp:"1700000000",type:"text",text:{body:"Synthetic"}}]});assert.equal(projectInbox([raw,raw],"123456789").messages.length,1);});
test("out of order read delivered sent does not regress status",()=>{const statuses=["read","sent","delivered","failed"].map(status=>envelope({statuses:[{id:"out-1",recipient_id:"synthetic",timestamp:"1700000000",status}]}));assert.equal(projectInbox(statuses,"123456789").messages[0].status,"READ");});
test("foreign WABA excluded and unsupported media not invented",()=>{const raw=envelope({messages:[{id:"m1",from:"synthetic",type:"image"}]});assert.equal(projectInbox([raw],"987654321").messages.length,0);assert.equal(projectInbox([raw],"123456789").messages[0].text,"");});
test("sender phone is shown independently of stable WhatsApp user ID",()=>{
 const raw=envelope({messages:[{id:"m2",from:"447700900123",from_user_id:"GB.synthetic",type:"text",text:{body:"Synthetic"}}]});
 const m=projectInbox([raw],"123456789").messages[0];assert.equal(m.participant,"GB.synthetic");assert.equal(m.participantPhone,"+447700900123");
});
test("username-only identity never becomes an invented phone number",()=>{
 const raw=envelope({messages:[{id:"m3",from_user_id:"GB.synthetic",type:"text"}]});assert.equal(projectInbox([raw],"123456789").messages[0].participantPhone,undefined);
});
