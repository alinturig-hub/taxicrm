import {test} from "node:test";
import assert from "node:assert/strict";
import {editableTemplate,editTemplate} from "./template-edit";
const env={NODE_ENV:"test" as const,META_WHATSAPP_ENABLED:"true",META_WHATSAPP_TEMPLATE_SUBMISSION_ENABLED:"true",META_WHATSAPP_APP_ID:"123456789",META_WHATSAPP_WABA_ID:"987654321",META_WHATSAPP_GRAPH_VERSION:"v999.0",META_WHATSAPP_ACCESS_TOKEN:"synthetic-edit-token-not-real"};
const item={id:"12345",name:"synthetic_booking",status:"APPROVED",category:"UTILITY",language:"en_GB",components:[{type:"HEADER",format:"TEXT",text:"Booking update"},{type:"BODY",text:"Hello {{1}}.",example:{body_text:[["Example"]]}},{type:"FOOTER",text:"Example company"},{type:"BUTTONS",buttons:[{type:"URL",text:"Manage",url:"https://example.test/{{1}}",example:["synthetic"]}]}]};
const draft=editableTemplate(item).draft!;
test("existing templates hydrate all supported components and examples",()=>{
 assert.equal(draft.samples[0],"Example");assert.equal(draft.footer,"Example company");assert.equal(draft.header?.format,"TEXT");assert.equal(draft.buttons?.[0].example,"synthetic");
});
test("unknown components or extra action fields disable edit instead of dropping content",()=>{
 for(const patch of [{components:[...item.components,{type:"CAROUSEL"}]},{components:[{type:"BODY",text:"Hello",unknown:true}]},{components:[{type:"BODY",text:"Hi"},{type:"BUTTONS",buttons:[{type:"FLOW",text:"Flow",flow_id:"123456",flow_action:"navigate"}]}]}])assert.equal(editableTemplate({...item,...patch}).draft,undefined);
});
test("edit verifies account ownership and replaces components only on the correct ID",async()=>{
 let calls=0;const result=await editTemplate(item.id,draft,env,async(url,opts)=>{
  calls++;const u=new URL(String(url));assert.equal(u.origin,"https://graph.facebook.com");
  if(calls===1){assert.equal(opts?.method,"GET");assert.equal(u.pathname,"/v999.0/987654321/message_templates");return Response.json({data:[item]});}
  assert.equal(u.pathname,"/v999.0/12345");assert.equal(opts?.method,"POST");const payload=JSON.parse(String(opts?.body));assert.deepEqual(Object.keys(payload),["components"]);assert.deepEqual(payload.components.map((x:{type:string})=>x.type),["HEADER","BODY","FOOTER","BUTTONS"]);return Response.json({success:true});
 });assert.equal(calls,2);assert.equal(result.edited,true);
});
test("wrong account, immutable changes and pending status prevent writes",async()=>{
 for(const found of [{...item,id:"55555"},{...item,status:"PENDING"},{...item,language:"ro"},{...item,parameter_format:"NAMED"}]){
  let calls=0;await assert.rejects(editTemplate(item.id,draft,env,async()=>{calls++;return Response.json({data:[found]});}));assert.equal(calls,1);
 }
});
test("ambiguous edit responses are not retried",async()=>{
 for(const reply of [()=>{throw Error("synthetic network failure");},()=>new Response("malformed"),()=>new Response("error",{status:500})]){
  let calls=0;await assert.rejects(editTemplate(item.id,draft,env,async()=>{calls++;if(calls===1)return Response.json({data:[item]});return reply();}),/TEMPLATE_SUBMISSION_UNCONFIRMED/);assert.equal(calls,2);
 }
});
