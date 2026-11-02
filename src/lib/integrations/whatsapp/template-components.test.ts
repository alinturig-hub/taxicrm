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
 for(const buttons of [[{type:"URL",text:"Book",url:"javascript:alert(1)"}],[{type:"QUICK_REPLY",text:"Reply",url:"https://example.test"}],Array.from({length:4},()=>({type:"QUICK_REPLY",text:"Reply"}))])assert.throws(()=>templatePreview({...draft,buttons}),/INVALID_TEMPLATE_BUTTONS/);
});
