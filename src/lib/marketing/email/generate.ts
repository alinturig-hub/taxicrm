import { ollamaOriginAllowed, type ModelConnection } from '@/lib/ai/owner-agent/providers';
export class EmailGenerationError extends Error { constructor(public code:string, public status=503){super(code);} }
type Env=Readonly<Record<string,string|undefined>>;
export function localEmailModel(env:Env=process.env):ModelConnection|null {
 const model=env.EMAIL_AI_OLLAMA_MODEL||'',raw=env.EMAIL_AI_OLLAMA_BASE_URL||'';
 if(!model&&!raw)return null;
 try { const u=new URL(raw);if(!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/.test(model)||u.username||u.password||u.search||u.hash||!['','/','/v1','/v1/'].includes(u.pathname)||!ollamaOriginAllowed(u,env))throw Error();return {provider:'OLLAMA',model,endpoint:u.origin+'/v1/chat/completions',apiKey:''}; }
 catch{throw new EmailGenerationError('MODEL_NOT_CONFIGURED');}
}
export async function generateEmail(prompt:string,connection:ModelConnection,env:Env=process.env,transport:typeof fetch=fetch) {
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>2000)throw new EmailGenerationError('INVALID_PROMPT',400);
 let url:URL;try{
  url=new URL(connection.endpoint);if(url.username||url.password||url.search||url.hash)throw Error();
  if(connection.provider==='OLLAMA'){if(!ollamaOriginAllowed(url,env)||url.pathname!=='/v1/chat/completions')throw Error();url.pathname='/api/chat';}
  else if(connection.provider==='OPENAI'){if(url.href!=='https://api.openai.com/v1/chat/completions')throw Error();}
  else if(connection.provider==='ANTHROPIC'){if(url.href!=='https://api.anthropic.com/v1/messages')throw Error();}
  else throw Error();
 }catch{throw new EmailGenerationError('MODEL_ENDPOINT_INVALID');}
 const ollama=connection.provider==='OLLAMA',anthropic=connection.provider==='ANTHROPIC';
 const instruction='Write a marketing email template based on the user brief. Reply ONLY with a JSON object containing exactly the string fields "subject" and "body". Use the language requested by the brief, default to English. Plain text only, no HTML, no markdown fences. Do not invent factual offers, prices, links or guarantees: use clear placeholders for unspecified details. Keep subject under 200 characters and body under 12000 characters. Do not add an unsubscribe link; the sending system handles it.';
 const headers:Record<string,string>={'content-type':'application/json'};
 if(anthropic){headers['x-api-key']=connection.apiKey;headers['anthropic-version']='2023-06-01';} else if(!ollama) headers.authorization=`Bearer ${connection.apiKey}`;
 try{
  const response=await transport(url.toString(),{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(ollama?90000:30000),headers,body:JSON.stringify({model:connection.model,stream:false,...(ollama?{think:false,format:'json',options:{temperature:0.4,num_predict:1400}}:anthropic?{max_tokens:1400,temperature:0.4}:{max_completion_tokens:1400}),...(anthropic?{system:instruction,messages:[{role:'user',content:prompt.trim()}]}:{messages:[{role:'system',content:instruction},{role:'user',content:prompt.trim()}]})})});
  if(!response.ok)throw new Error();const reader=response.body?.getReader();if(!reader)throw new Error();let size=0,text='';const decoder=new TextDecoder();for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>64000){await reader.cancel();throw new Error();}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();const data=JSON.parse(text);
  const content=ollama?(data?.message?.tool_calls?.length?'':data?.message?.content):anthropic?(data?.content?.length===1&&data.content[0]?.type==='text'?data.content[0].text:''):(data?.choices?.[0]?.message?.tool_calls?.length?'':data?.choices?.[0]?.message?.content);
  if(typeof content!=='string')throw new Error();const out=JSON.parse(content);
  if(!out||typeof out!=='object'||Array.isArray(out)||Object.keys(out).sort().join(',')!=='body,subject'||typeof out.subject!=='string'||typeof out.body!=='string'||!out.subject.trim()||!out.body.trim()||out.subject.length>200||out.body.length>12000||/[\r\n\x00-\x1f\x7f]/.test(out.subject)||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(out.body))throw new Error();
  return {subject:out.subject.trim(),body:out.body.trim()};
 }catch{throw new EmailGenerationError('GENERATION_UNAVAILABLE');}
}
