import {test} from "node:test";
import assert from "node:assert/strict";
import {templatePreview} from "./templates";
const draft={name:"synthetic_offer",language:"en_GB",category:"MARKETING",text:"Hello {{1}}",samples:["Synthetic"]};
test("image body and buttons produce ordered Meta components",()=>{
 const p=templatePreview({...draft,header:{format:"IMAGE",handle:"synthetic-upload-handle"},buttons:[{type:"URL",text:"Book",url:"https://example.test/book"},{type:"PHONE_NUMBER",text:"Call",phone_number:"+447700900123"},{type:"QUICK_REPLY",text:"Details"}]});
 assert.deepEqual(p.payload.components.map(c=>c.type),["HEADER","BODY","BUTTONS"]);
});
test("image URLs are not accepted as uploaded media handles",()=>{
 assert.throws(()=>templatePreview({...draft,header:{format:"IMAGE",handle:"https://example.test/image.jpg"}}),/INVALID_IMAGE_HEADER/);
});
test("unsafe links excessive buttons and unsupported fields fail",()=>{
 for(const buttons of [[{type:"URL",text:"Book",url:"javascript:alert(1)"}],[{type:"QUICK_REPLY",text:"Reply",url:"https://example.test"}],Array.from({length:11},()=>({type:"QUICK_REPLY",text:"Reply"}))])assert.throws(()=>templatePreview({...draft,buttons}),/INVALID_TEMPLATE_BUTTONS/);
});
test("text header and footer surround body and reject variables or oversized content",()=>{
 const result=templatePreview({...draft,header:{format:"TEXT",text:"Booking update"},footer:"Need A Cab Plus"});
 assert.deepEqual(result.payload.components.map(c=>c.type),["HEADER","BODY","FOOTER"]);
 assert.throws(()=>templatePreview({...draft,header:{format:"TEXT",text:"Hello {{1}}"}}));
 assert.throws(()=>templatePreview({...draft,footer:"x".repeat(61)}));
 assert.throws(()=>templatePreview({...draft,buttons:[{type:"QUICK_REPLY",text:"Yes"},{type:"URL",text:"Book",url:"https://example.test"},{type:"QUICK_REPLY",text:"No"}]}));
});
test("ten quick replies are supported and eleven fail",()=>{
 const buttons=Array.from({length:10},(_,i)=>({type:"QUICK_REPLY",text:`Option ${i+1}`}));
 const p=templatePreview({...draft,buttons});assert.equal((p.payload.components.at(-1) as {buttons:unknown[]}).buttons.length,10);
 assert.throws(()=>templatePreview({...draft,buttons:[...buttons,{type:"QUICK_REPLY",text:"Eleven"}]}));
});
test("dynamic URL requires a suffix example and cannot vary the host",()=>{
 const button={type:"URL",text:"Manage booking",url:"https://example.test/booking/{{1}}",example:"synthetic-reference"};
 const p=templatePreview({...draft,buttons:[button]});assert.deepEqual((p.payload.components.at(-1) as {buttons:{example:string[]}[]}).buttons[0].example,["synthetic-reference"]);
 for(const patch of [{example:""},{url:"https://example.test/{{1}}/track"},{url:"https://example.test{{1}}"},{url:"javascript:{{1}}"}])assert.throws(()=>templatePreview({...draft,buttons:[{...button,...patch}]}));
});
test("named body and header variables emit Meta named examples",()=>{
 const p=templatePreview({...draft,parameterFormat:"NAMED",text:"Hello {{customer_name}}, reference {{booking_id}}",samples:["Example","SYNTHETIC-123"],header:{format:"TEXT",text:"Hello {{customer_name}}",samples:["Example"]}});
 assert.equal(p.payload.parameter_format,"NAMED");assert.equal(p.renderedText,"Hello Example, reference SYNTHETIC-123");
 assert.deepEqual(p.payload.components[1].example,{body_text_named_params:[{param_name:"customer_name",example:"Example"},{param_name:"booking_id",example:"SYNTHETIC-123"}]});
 assert.throws(()=>templatePreview({...draft,parameterFormat:"NAMED",text:"Hi {{Customer}}",samples:["Example"]}));
});
test("supported media, copy code and published Flow payloads remain separate",()=>{
 for(const format of ["VIDEO","DOCUMENT"])assert.equal(templatePreview({...draft,header:{format,handle:"synthetic-handle"}}).payload.components[0].format,format);
 assert.equal(templatePreview({...draft,header:{format:"LOCATION"}}).payload.components[0].format,"LOCATION");
 const copy=templatePreview({...draft,buttons:[{type:"COPY_CODE",text:"",example:"SYNTHETIC"}]});assert.deepEqual((copy.payload.components.at(-1) as {buttons:unknown[]}).buttons,[{type:"COPY_CODE",example:"SYNTHETIC"}]);
 assert.doesNotThrow(()=>templatePreview({...draft,buttons:[{type:"FLOW",text:"Open form",flow_id:"123456789"}]}));
 assert.throws(()=>templatePreview({...draft,buttons:[{type:"FLOW",text:"Open form",flow_id:"123456789"},{type:"QUICK_REPLY",text:"Yes"}]}));
});
