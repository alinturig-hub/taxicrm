import type {PoolClient} from 'pg';
import {parseState,sourceFields,type GatewayState,type IntentV2} from './notifications-v2-contract';
export async function fullGatewayState(db:PoolClient,scope:string,intent:IntentV2):Promise<GatewayState>{
 const conv=(await db.query('SELECT * FROM "WhatsAppConversation" WHERE scope=$1 AND participant=$2',[scope,intent.recipient])).rows[0];if(!conv)throw Error('STAGE_CONVERSATION_MISSING');
 const grant=(await db.query('SELECT * FROM "WhatsAppRecipientGrant" WHERE scope=$1 AND recipient=$2',[scope,intent.recipient])).rows[0],booking=(await db.query(`SELECT * FROM "Booking" WHERE provider='AUTOCAB' AND "externalId"=$1`,[intent.booking_id.slice(8)])).rows[0];
 const inbound=(await db.query(`SELECT max("occurredAt") AS at FROM "WhatsAppMessage" WHERE scope=$1 AND "conversationId"=$2 AND direction='INBOUND' AND status='RECEIVED' AND content->>'origin'='customer' AND content->>'type' IN ('text','image','audio','video','document','interactive','button','location') AND "occurredAt"<=now()`,[scope,conv.id])).rows[0].at;
 const valid=Boolean(grant&&booking?.normalCustomerId&&grant.customerId===booking.normalCustomerId&&new Date(grant.validUntil).getTime()>Date.now()&&new Date(grant.verifiedAt).getTime()<=Date.now());
 return parseState({conversation_id:conv.id,conversation_revision:conv.revision,operator:conv.mode==='OPERATOR',last_eligible_inbound_at:inbound?new Date(inbound).toISOString():null,recipient_verified:valid,service_allowed:valid&&grant.serviceAllowed,suppressed:Boolean(grant?.suppressed),provider_status:'NONE',definitively_unavailable:false,seen:false,highest_booking_revision:intent.revision,capabilities:{text:true,named:true,dynamic_buttons:true,media:false,sms:false,parameter_sources:sourceFields}});
}
