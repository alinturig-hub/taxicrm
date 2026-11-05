/** Preparation contract only. No credentials, DB, HTTP transport or execution entrypoint. */
import {createHash} from 'node:crypto';
import {parseIntent,stable,type IntentV2,type ResultV2,type GatewayState} from './notifications-v2-contract';
import {operationalPayload,type ProviderTemplate} from './operational-adapters';
export function prepareControlledBookingConfirmed(input:{testId:string;intent:IntentV2;decision:ResultV2;state:GatewayState;template:ProviderTemplate;templateFingerprint:string},allowlist:{workspace:string;recipient:string},now=Date.now()){
 const {testId,decision,state,template}=input,intent=parseIntent(input.intent,allowlist.workspace);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(testId)||intent.booking_id!=='autocab:SYNTHETIC-BC-'+testId)throw Error('CONTROLLED_TEST_REQUIRES_NEW_BOOKING');
 if(intent.recipient!==allowlist.recipient||!/^\+[1-9]\d{7,14}$/.test(allowlist.recipient))throw Error('CONTROLLED_TEST_RECIPIENT_NOT_ALLOWED');
 if(intent.event_type!=='booking.confirmed'||intent.revision!==1||intent.origin!=='operational_notification')throw Error('CONTROLLED_TEST_WRONG_TRIGGER');
 if(intent.content.body_mappings.length!==1||intent.content.body_mappings[0].variable!=='1'||intent.content.body_mappings[0].source!=='booking_id'||intent.content.button_mappings.length)throw Error('CONTROLLED_TEST_MAPPING_MISMATCH');
 if(template.name!=='nac_booking_confirmation_v1'||template.language!=='en_GB'||intent.idempotency_key.startsWith('owner-transport-v1:'))throw Error('CONTROLLED_TEST_TEMPLATE_MISMATCH');
 // Pin a template payload, not whichever content mode happened to win in a prior rehearsal.
 if(decision.content_mode!=='template')throw Error('CONTROLLED_TEST_TEMPLATE_REQUIRED');
 const payload=operationalPayload(intent,decision,state,now,{template,fingerprint:input.templateFingerprint});
 const manifest={version:1,purpose:'CONTROLLED_BOOKING_CONFIRMED_TRIGGER',state:'PREPARED_NO_SEND',test_id:testId,booking_id:intent.booking_id,request_rule:intent.rule,recipient:intent.recipient,operation_key:intent.idempotency_key,template_fingerprint:input.templateFingerprint,payload,payload_sha256:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),rendered_text:decision.rendered_text,maximum_provider_posts:1,automatic_retries:0,sms_fallback:false,expires_at:intent.expires_at,execution_enabled:false,requires:['fresh signed canonical application context','current approved Meta snapshot','live suppression and operator checks','durable unique claim using the new operation key','explicit approval for this new manifest; never inherit completed test approval']};
 return {...manifest,manifest_sha256:createHash('sha256').update(stable(manifest)).digest('hex')};
}
