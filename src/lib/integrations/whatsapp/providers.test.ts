import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProvider, providerCapabilities, providerTemplates, sendProviderMessage } from "./providers";
test("provider selection is explicit and rejects arbitrary transports",()=>{
 assert.equal(parseProvider("META"),"META"); assert.equal(parseProvider("COMBOT"),"COMBOT");
 assert.throws(()=>parseProvider("https://example.com"));
});
test("both transports remain incapable of sending until activated",()=>{
 for (const provider of ["META","COMBOT"] as const) {
 assert.equal(providerCapabilities(provider,{NODE_ENV:"test"}).canSend,false);
 assert.equal(providerCapabilities(provider,{NODE_ENV:"test"}).canReceive,false);
 }
});
test("Com.Bot never guesses an endpoint or falls back to Meta",async()=>{
 let calls=0;
 await assert.rejects(providerTemplates("COMBOT",{NODE_ENV:"test"},async()=>{calls++;throw Error("unexpected");}), /COMBOT_API_CONTRACT_REQUIRED/);
 assert.equal(calls,0);
});
test("outbound messages require identity and never send on either provider",async()=>{
 const message={workspaceKey:"synthetic",connectionId:"test",idempotencyKey:"test-1",recipient:"+447700900123",templateName:"test"};
 for(const provider of ["META","COMBOT"] as const)
 await assert.rejects(sendProviderMessage(provider,message));
 await assert.rejects(sendProviderMessage("META",{...message,workspaceKey:""}),/INVALID_OUTBOUND_MESSAGE/);
});
