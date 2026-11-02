import {test} from "node:test";import assert from "node:assert/strict";
import {receiveMetaEnvelope,type InboxRecord} from "./inbox";
const body=()=>Buffer.from(JSON.stringify({object:"whatsapp_business_account",entry:[{id:"123456789",changes:[{field:"messages",value:{messages:[{id:"synthetic-message-1"}]}}]}]}));
test("ack waits for persistence; transport retries have stable scoped hashes",async()=>{
 const records:InboxRecord[]=[];let persisted=false;
 const result=await receiveMetaEnvelope(body(),"123456789",async r=>{records.push(r);persisted=true;});assert.equal(result.accepted,true);assert.equal(persisted,true);
 await receiveMetaEnvelope(body(),"123456789",async r=>{records.push(r);});assert.equal(records[0].bodyHash,records[1].bodyHash);assert.equal(records[0].connectionKey,"META:123456789");
});
test("database failure never yields success",async()=>{
 await assert.rejects(receiveMetaEnvelope(body(),"123456789",async()=>{throw Error("synthetic-database-down")}),/synthetic-database-down/);
});
test("malformed JSON unknown WABA and missing configuration never write",async()=>{
 let calls=0;const save=async()=>{calls++;};
 await assert.rejects(receiveMetaEnvelope(Buffer.from('{'),"123456789",save),/INVALID_JSON/);
 await assert.rejects(receiveMetaEnvelope(body(),"987654321",save),/WABA_MISMATCH/);
 await assert.rejects(receiveMetaEnvelope(body(),undefined,save),/WABA_NOT_CONFIGURED/);
 assert.equal(calls,0);
});
