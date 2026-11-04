import {test} from "node:test";
import assert from "node:assert/strict";
import {submitTemplate} from "./templates";
const env={NODE_ENV:"test" as const,META_WHATSAPP_ENABLED:"true",META_WHATSAPP_TEMPLATE_SUBMISSION_ENABLED:"true",META_WHATSAPP_APP_ID:"123456789",META_WHATSAPP_WABA_ID:"987654321",META_WHATSAPP_GRAPH_VERSION:"v999.0",META_WHATSAPP_ACCESS_TOKEN:"synthetic-token-never-a-real-secret"};
const draft={name:"synthetic_offer",language:"en_GB",category:"MARKETING",text:"Hello {{1}}",samples:["Synthetic"]};
test("submission requires explicit enablement before network access",async()=>{
 let calls=0;await assert.rejects(submitTemplate(draft,{...env,META_WHATSAPP_TEMPLATE_SUBMISSION_ENABLED:"false"},async()=>{calls++;throw Error();}),/TEMPLATE_SUBMISSION_DISABLED/);assert.equal(calls,0);
});
test("submission uses fixed Meta origin and validated body, never messages endpoint",async()=>{
 const result=await submitTemplate(draft,env,async(url,options)=>{assert.equal(String(url),"https://graph.facebook.com/v999.0/987654321/message_templates");assert.equal(options?.method,"POST");assert.equal(options?.redirect,"error");assert.equal(JSON.parse(options?.body as string).name,draft.name);return Response.json({id:"123456789",status:"PENDING"});});assert.equal(result.status,"PENDING");assert.equal(result.submitted,true);
});
test("ambiguous transport failure is redacted and never retried",async()=>{
 let calls=0;await assert.rejects(submitTemplate(draft,env,async()=>{calls++;throw Error(env.META_WHATSAPP_ACCESS_TOKEN);}),/TEMPLATE_SUBMISSION_UNCONFIRMED/);assert.equal(calls,1);
});
test("upstream server errors leave submission unconfirmed without retry",async()=>{
 let calls=0;await assert.rejects(submitTemplate(draft,env,async()=>{calls++;return new Response("upstream",{status:500});}),/TEMPLATE_SUBMISSION_UNCONFIRMED/);assert.equal(calls,1);
});
