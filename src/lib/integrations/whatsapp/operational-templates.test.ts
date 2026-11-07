import test from 'node:test';import assert from 'node:assert/strict';
import {isBookingTemplate} from './template-purpose';import {templateWorkspaceRequest} from './template-workspace';
import {signedHeaders,verifyService} from './service-auth';import {templateMediaBody} from './template-media-body';
const draft={name:'nac_booking_synthetic_v2',category:'UTILITY',language:'en_GB',text:'Hello {{1}}, booking {{2}}.',samples:['Demo','SYNTHETIC-1']};
test('ownership is an explicit name convention, not every Utility template',()=>{for(const n of ['nac_booking_confirmation_v1','nac_driver_on_the_way_v1','nac_journey_completed_v1'])assert.equal(isBookingTemplate(n),true);for(const n of ['summer_offer','order_update','nac_booking_','nac_driver_link/../'])assert.equal(isBookingTemplate(n),false)});
test('operational create needs capability, confirmation, valid prefix and Utility category',async()=>{
 let calls=0;const submit=async()=>{calls++;return {id:'123',status:'PENDING',submitted:true,notice:'synthetic'}};
 const request={action:'submit',draft,confirmSubmission:true};
 await assert.rejects(templateWorkspaceRequest(request,undefined,{submit}),/MUTATIONS/);
 await assert.rejects(templateWorkspaceRequest({...request,confirmSubmission:false},undefined,{manage:true,submit}),/CONFIRMATION/);
 await assert.rejects(templateWorkspaceRequest({...request,draft:{...draft,name:'campaign_offer'}},undefined,{manage:true,submit}),/OPERATIONAL_TEMPLATE_REQUIRED/);
 await assert.rejects(templateWorkspaceRequest({...request,draft:{...draft,category:'MARKETING'}},undefined,{manage:true,submit}),/OPERATIONAL_TEMPLATE_REQUIRED/);
 assert.equal(calls,0);await templateWorkspaceRequest(request,undefined,{manage:true,submit});assert.equal(calls,1);
 await assert.rejects(templateWorkspaceRequest({action:'edit',draft},undefined,{manage:true,submit}));assert.equal(calls,1);
});
test('media bytes are bound to the HMAC; altered body and replay fail',async()=>{
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10]),path='/api/internal/whatsapp/v1/template-media',key='synthetic-key',secret='x'.repeat(48),now=Date.now(),headers=signedHeaders('POST',path,bytes,key,secret,now);
 const request=new Request('https://crm.example'+path,{method:'POST',headers,body:bytes});let used=false;
 await verifyService(request,bytes,key,secret,async()=>{if(used)return false;used=true;return true},now);
 await assert.rejects(verifyService(request,bytes,key,secret,async()=>false,now),/REPLAY/);
 await assert.rejects(verifyService(request,new Uint8Array([1]),key,secret,async()=>true,now),/UNAUTHORIZED/);
 assert.deepEqual(Array.from(await templateMediaBody(request)),Array.from(bytes));
});
test('binary reader rejects empty and oversized uploads before provider calls',async()=>{
 await assert.rejects(templateMediaBody(new Request('https://crm.example',{method:'POST',body:''})),/INVALID_MEDIA/);
 await assert.rejects(templateMediaBody(new Request('https://crm.example',{method:'POST',body:new Uint8Array(16*1024*1024+1)})),/BODY_TOO_LARGE/);
});
test('capabilities expose no credentials and require every server switch',async()=>{
 const env={NODE_ENV:'test' as const,META_WHATSAPP_ENABLED:'true',META_WHATSAPP_APP_ID:'123456',META_WHATSAPP_WABA_ID:'123456',META_WHATSAPP_GRAPH_VERSION:'v23.0',META_WHATSAPP_ACCESS_TOKEN:'synthetic-token-for-tests-only',META_WHATSAPP_TEMPLATE_SUBMISSION_ENABLED:'true'};
 assert.deepEqual(await templateWorkspaceRequest({action:'capabilities'},undefined,{manage:true,env}),{manage:true,inPlaceEdit:false});
 assert.deepEqual(await templateWorkspaceRequest({action:'capabilities'},undefined,{manage:false,env}),{manage:false,inPlaceEdit:false});
 assert.deepEqual(await templateWorkspaceRequest({action:'capabilities'},undefined,{manage:true,env:{...env,META_WHATSAPP_TEMPLATE_SUBMISSION_ENABLED:'false'}}),{manage:false,inPlaceEdit:false});
 await assert.rejects(templateWorkspaceRequest({action:'list',draft},undefined),/INVALID_REQUEST/);
});
