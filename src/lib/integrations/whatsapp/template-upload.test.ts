import {test} from "node:test";
import assert from "node:assert/strict";
import {imageType,uploadTemplateImage} from "./template-upload";
const env={NODE_ENV:"test" as const,META_WHATSAPP_ENABLED:"true",META_WHATSAPP_TEMPLATE_SUBMISSION_ENABLED:"true",META_WHATSAPP_APP_ID:"123456789",META_WHATSAPP_WABA_ID:"987654321",META_WHATSAPP_GRAPH_VERSION:"v999.0",META_WHATSAPP_ACCESS_TOKEN:"synthetic-token-for-upload-tests"};
const image=new Uint8Array([137,80,78,71,13,10,26,10]);
test("image type uses bytes, rejects wrong formats and oversized images",()=>{
 assert.equal(imageType(image),"image/png");assert.equal(imageType(new Uint8Array([255,216,255])),"image/jpeg");
 assert.throws(()=>imageType(new Uint8Array([1,2,3])));assert.throws(()=>imageType(new Uint8Array(5*1024*1024+1)));
});
test("upload uses fixed Meta origin, byte length and returned session; no credentials in results",async()=>{
 let calls=0;
 const result=await uploadTemplateImage(image,env,async(url,options)=>{
  calls++;const u=new URL(String(url));assert.equal(u.origin,"https://graph.facebook.com");assert.equal(options?.method,"POST");assert.equal(options?.redirect,"error");
  if(calls===1){assert.equal(u.pathname,"/v999.0/123456789/uploads");assert.equal(u.searchParams.get("file_length"),"8");return Response.json({id:"upload:synthetic-session?sig=synthetic-signature"});}
  assert.equal(u.pathname,"/v999.0/upload:synthetic-session");assert.equal(u.searchParams.get("sig"),"synthetic-signature");assert.equal((options?.headers as Record<string,string>).file_offset,"0");return Response.json({h:"synthetic-handle"});
 });assert.equal(calls,2);assert.deepEqual(result,{handle:"synthetic-handle"});
});
test("upload flag fails before requests and errors do not expose tokens",async()=>{
 let calls=0;await assert.rejects(uploadTemplateImage(image,{...env,META_WHATSAPP_TEMPLATE_SUBMISSION_ENABLED:"false"},async()=>{calls++;throw Error();}));assert.equal(calls,0);
 await assert.rejects(uploadTemplateImage(image,env,async()=>{throw Error(env.META_WHATSAPP_ACCESS_TOKEN);}),e=>!String(e).includes(env.META_WHATSAPP_ACCESS_TOKEN));
});
test("upload session includes filename and PDF type",async()=>{
 const {uploadTemplateMedia}=await import("./template-upload");let calls=0;
 const result=await uploadTemplateMedia(new TextEncoder().encode("%PDF-synthetic"),env,async(url)=>{
  calls++;const u=new URL(String(url));if(calls===1){assert.equal(u.searchParams.get("file_name"),"template_sample.pdf");assert.equal(u.searchParams.get("file_type"),"application/pdf");return Response.json({id:"upload:synthetic"});}return Response.json({h:"synthetic-document-handle"});
 });assert.equal(result.format,"DOCUMENT");assert.equal(calls,2);
});
