import {test} from "node:test";
import assert from "node:assert/strict";
import {combotTemplateList,combotTemplateMessage} from "./combot-contract";
test("documented list path uses bounded offset pagination and bearer auth",()=>{
 assert.deepEqual(combotTemplateList("123456789","v23.0"),{method:"GET",path:"/api/meta/v23.0/123456789/message_templates?limit=10&offset=0",authentication:"BEARER"});
 assert.throws(()=>combotTemplateList("../other","v23.0"));
});
test("template request maps synthetic E.164 and body variables without sending",()=>{
 const input={phoneNumberId:"123456789",version:"v23.0",recipient:"+447700900123",name:"synthetic_offer",language:"en_GB",parameters:["Synthetic"]};
 const plan=combotTemplateMessage(input);
 assert.equal(plan.body.to,"447700900123");assert.equal(plan.body.template.components[0].parameters[0].text,"Synthetic");
 assert.throws(()=>combotTemplateMessage({...input,recipient:"invalid"}));
 assert.throws(()=>combotTemplateMessage({...input,version:"../messages"}));
});
