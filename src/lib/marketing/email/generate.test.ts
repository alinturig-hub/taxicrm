import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateEmail, localEmailModel } from './generate';
import type { ModelConnection } from '@/lib/ai/owner-agent/providers';
const env={TAXICRM_AGENT_OLLAMA_ORIGINS:'["http://127.0.0.1:11434"]'};
const payload=JSON.stringify({subject:'Airport transfers',body:'Book your journey today.'});
test('uses provider-specific transport and returns only validated draft',async()=>{
 for(const provider of ['OLLAMA','OPENAI','ANTHROPIC'] as const){
  const conn:ModelConnection={provider,model:'synthetic',apiKey:provider==='OLLAMA'?'':'synthetic-key',endpoint:provider==='OLLAMA'?'http://127.0.0.1:11434/v1/chat/completions':provider==='OPENAI'?'https://api.openai.com/v1/chat/completions':'https://api.anthropic.com/v1/messages'};
  const fake:typeof fetch=async(url,init)=>{assert.equal(init?.method,'POST');assert.equal(init?.redirect,'error');const body=JSON.parse(String(init?.body));assert.doesNotMatch(JSON.stringify(body),/synthetic-key/);if(provider==='OLLAMA'){assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(body.think,false);}return Response.json(provider==='OLLAMA'?{message:{content:payload}}:provider==='OPENAI'?{choices:[{message:{content:payload}}]}:{content:[{type:'text',text:payload}]});};
  assert.deepEqual(await generateEmail('Airport promotion',conn,env,fake),{subject:'Airport transfers',body:'Book your journey today.'});
 }
});
test('rejects unsafe destinations and malformed model responses',async()=>{
 const c:ModelConnection={provider:'OLLAMA',model:'synthetic',apiKey:'',endpoint:'http://127.0.0.1:11434/v1/chat/completions'};
 await assert.rejects(generateEmail('x',c,{},async()=>new Response()),/MODEL_ENDPOINT_INVALID/);
 await assert.rejects(generateEmail('x',{...c,endpoint:'http://example.test/v1/chat/completions'},env,async()=>new Response()),/MODEL_ENDPOINT_INVALID/);
 for(const value of ['not json',JSON.stringify({subject:'Bad\nsubject',body:'text'}),JSON.stringify({subject:'a',body:'b',extra:'x'})]) await assert.rejects(generateEmail('x',c,env,async()=>Response.json({message:{content:value}})),/GENERATION_UNAVAILABLE/);
 await assert.rejects(generateEmail('',c,env,async()=>new Response()),/INVALID_PROMPT/);
});

test('local generator only accepts a separately configured allowlisted Ollama origin',()=>{
 assert.equal(localEmailModel({}),null);
 assert.throws(()=>localEmailModel({EMAIL_AI_OLLAMA_MODEL:'qwen3:30b-a3b',EMAIL_AI_OLLAMA_BASE_URL:'http://10.0.1.1:11434'}),/MODEL_NOT_CONFIGURED/);
 const configured=localEmailModel({...env,EMAIL_AI_OLLAMA_MODEL:'qwen3:30b-a3b',EMAIL_AI_OLLAMA_BASE_URL:'http://127.0.0.1:11434'});
 assert.equal(configured?.endpoint,'http://127.0.0.1:11434/v1/chat/completions');
 assert.equal(configured?.provider,'OLLAMA');
});
