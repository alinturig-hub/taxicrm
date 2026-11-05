import {createHash,randomUUID} from 'node:crypto';
import {parameterKeys} from './template-parameters';
import {parseResult,stable,type IntentV2,type ResultV2,type GatewayState} from './notifications-v2-contract';
export type MetaPayload={messaging_product:'whatsapp';to:string;type:'text'|'template';text?:{preview_url:false;body:string};template?:{name:string;language:{code:string};components?:Record<string,unknown>[]}};
export type ProviderTemplate={id:string;name:string;language:string;status:string;category:string;parameter_format?:'POSITIONAL'|'NAMED';components:Record<string,unknown>[]};
export function templateFingerprint(t:ProviderTemplate){return createHash('sha256').update(stable(t)).digest('hex')}
export function windowOpen(state:GatewayState,now:number){const at=state.last_eligible_inbound_at===null?NaN:Date.parse(state.last_eligible_inbound_at);return Number.isFinite(at)&&at<=now&&now-at<86400000}
function text(value:unknown,max=1024):asserts value is string{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f{}]/.test(value))throw Error('INVALID_SEND_PARAMETER')}
function recipient(value:string){if(!/^\+[1-9]\d{7,14}$/.test(value))throw Error('INVALID_SEND_RECIPIENT');return value.slice(1)}
/** Shared serializer used by the existing v1 sender and the operational v2 adapter. */
export function positionalTemplatePayload(to:string,name:string,language:string,parameters:string[]):MetaPayload{
 if(!/^[a-z0-9_]{1,512}$/.test(name)||!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language)||parameters.length>10)throw Error('INVALID_TEMPLATE_SEND');parameters.forEach(v=>text(v));
 return {messaging_product:'whatsapp',to:recipient(to),type:'template',template:{name,language:{code:language},...(parameters.length?{components:[{type:'body',parameters:parameters.map(text=>({type:'text',text}))}]}:{})}};
}
/** Full URL -> suffix, preserving the literal approved prefix and actual template slot. */
export function dynamicUrlSuffix(pattern:string,value:string){
 if(!pattern.endsWith('{{1}}')||/[{}]/.test(pattern.slice(0,-5)))throw Error('INVALID_BUTTON_TEMPLATE');const prefix=pattern.slice(0,-5);
 const base=new URL(prefix),url=new URL(value);if(base.protocol!=='https:'||url.protocol!=='https:'||base.username||base.password||url.username||url.password||base.hash||url.hash||!prefix.startsWith(base.origin+'/')||!value.startsWith(prefix))throw Error('BUTTON_URL_PREFIX_MISMATCH');
 const suffix=value.slice(prefix.length);text(suffix,2048);if(/\s/.test(suffix)||prefix+suffix!==value||url.origin!==base.origin)throw Error('BUTTON_URL_PREFIX_MISMATCH');return suffix;
}
/** Pure serialization: catalog examples are never send parameters. No credentials/network. */
export function operationalPayload(intent:IntentV2,result:ResultV2,state:GatewayState,now:number,approved?:{template:ProviderTemplate;fingerprint:string}):MetaPayload{
 parseResult(result,intent,state,now);
 if(result.result!=='ready'||result.channel!=='whatsapp'||state.operator||state.suppressed||!state.recipient_verified||!state.service_allowed||state.provider_status!=='NONE'||state.definitively_unavailable)throw Error('SEND_POLICY_BLOCKED');
 if(Date.parse(intent.expires_at)<=now)throw Error('NOTIFICATION_EXPIRED');
 if(result.content_mode==='text'){
  // Leave a bounded transport margin; Meta is still authoritative about window eligibility.
  if(!windowOpen(state,now)||Date.parse(state.last_eligible_inbound_at!)+86400000-now<=8000)throw Error('WHATSAPP_WINDOW_CLOSING');
  if(!result.rendered_text?.trim()||result.rendered_text.length>4096||/\{\{[^}]*\}\}/.test(result.rendered_text))throw Error('INVALID_SEND_TEXT');
  return {messaging_product:'whatsapp',to:recipient(intent.recipient),type:'text',text:{preview_url:false,body:result.rendered_text}};
 }
 if(result.content_mode!=='template'||!approved)throw Error('TEMPLATE_SNAPSHOT_REQUIRED');
 const t=approved.template;if(templateFingerprint(t)!==approved.fingerprint||approved.fingerprint!==intent.content.template.fingerprint||t.id!==intent.content.template.id||t.name!==intent.content.template.name||t.language!==intent.content.template.language)throw Error('TEMPLATE_MAPPING_MISMATCH');
 if(t.status!=='APPROVED'||t.category!=='UTILITY')throw Error('TEMPLATE_NOT_APPROVED');
 if(!/^[a-z0-9_]{1,512}$/.test(t.name)||!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(t.language)||!Array.isArray(t.components)||t.components.length>4)throw Error('INVALID_PROVIDER_TEMPLATE');
 const types=t.components.map(c=>c.type);if(new Set(types).size!==types.length||types.some(v=>!['BODY','FOOTER','HEADER','BUTTONS'].includes(String(v))))throw Error('UNSUPPORTED_TEMPLATE_COMPONENTS');
 const header=t.components.find(c=>c.type==='HEADER');if(header&&(header.format!=='TEXT'||typeof header.text!=='string'||/[{}]/.test(header.text)))throw Error('HEADER_ADAPTER_UNAVAILABLE');
 const body=t.components.find(c=>c.type==='BODY');if(!body||typeof body.text!=='string')throw Error('TEMPLATE_MAPPING_MISMATCH');
 const format=t.parameter_format||'POSITIONAL';if(!['POSITIONAL','NAMED'].includes(format))throw Error('TEMPLATE_MAPPING_MISMATCH');const keys=parameterKeys(body.text,format),parameters=result.body_parameters||[];
 if(keys.length!==parameters.length||keys.some(k=>!parameters.some(p=>p.variable===k)))throw Error('TEMPLATE_MAPPING_MISMATCH');
 const bodyParameters=keys.map(key=>{const value=parameters.find(p=>p.variable===key)!.value;text(value);return {type:'text',...(format==='NAMED'?{parameter_name:key}:{}),text:value}});
 if(body.text.replace(/\{\{([^{}]+)\}\}/g,(_,key)=>parameters.find(p=>p.variable===key)!.value)!==result.rendered_text)throw Error('TEMPLATE_RENDER_MISMATCH');
 const components:Record<string,unknown>[]=[];if(bodyParameters.length)components.push({type:'body',parameters:bodyParameters});
 const group=t.components.find(c=>c.type==='BUTTONS');if(group&&!Array.isArray(group.buttons))throw Error('INVALID_BUTTON_TEMPLATE');const buttons=(group?.buttons||[]) as Record<string,unknown>[];if(buttons.length>10)throw Error('INVALID_BUTTON_TEMPLATE');
 const supplied=result.button_parameters||[],used=new Set<number>();
 for(let index=0;index<buttons.length;index++){const b=buttons[index];
  if(b.type==='PHONE_NUMBER'){if(typeof b.phone_number!=='string'||!/^\+[1-9]\d{7,14}$/.test(b.phone_number))throw Error('INVALID_BUTTON_TEMPLATE');continue}
  if(b.type!=='URL'||typeof b.url!=='string')throw Error('BUTTON_BEHAVIOUR_NOT_IMPLEMENTED');
  if(!b.url.includes('{{')){const url=new URL(b.url);if(url.protocol!=='https:'||url.username||url.password||/[{}\s]/.test(b.url))throw Error('INVALID_BUTTON_TEMPLATE');continue}
  const p=supplied.find(p=>p.index===index);if(!p)throw Error('TEMPLATE_MAPPING_MISMATCH');used.add(index);components.push({type:'button',sub_type:'url',index:String(index),parameters:[{type:'text',text:dynamicUrlSuffix(b.url,p.value)}]});
 }
 if(used.size!==supplied.length)throw Error('TEMPLATE_MAPPING_MISMATCH');
 return {messaging_product:'whatsapp',to:recipient(intent.recipient),type:'template',template:{name:t.name,language:{code:t.language},...(components.length?{components}:{})}};
}
export type SimulatedOutcome={transport:'SIMULATED';status:'ACCEPTED'|'REJECTED'|'UNKNOWN';providerMessageId?:string;payload:MetaPayload};
/** In-process supplier simulator, deliberately no fetch argument or real transport fallback. */
export async function simulateProvider(payload:MetaPayload,scenario:'accepted'|'rejected'|'timeout'|'server-error'|'malformed'='accepted'):Promise<SimulatedOutcome>{
 const base={transport:'SIMULATED' as const,payload:JSON.parse(JSON.stringify(payload)) as MetaPayload};
 if(scenario==='rejected')return {...base,status:'REJECTED'};
 if(scenario!=='accepted')return {...base,status:'UNKNOWN'};
 return {...base,status:'ACCEPTED',providerMessageId:'simulated:'+randomUUID()};
}
