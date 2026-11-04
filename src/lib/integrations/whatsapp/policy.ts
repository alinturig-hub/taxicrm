import type {PoolClient} from 'pg';
import {normalizeJourneyPhone,journeyMilestones,journeyParameterKeys} from './journey';
export async function saveBinding(db:PoolClient,scope:string,input:Record<string,unknown>,actor:string){
 const {milestone,name,language,parameterKeys,enabled}=input;
 if(typeof milestone!=='string'||!journeyMilestones.includes(milestone as typeof journeyMilestones[number])||typeof name!=='string'||!/^[a-z0-9_]{1,512}$/.test(name)||typeof language!=='string'||!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language)||typeof enabled!=='boolean'||!Array.isArray(parameterKeys)||parameterKeys.length>10||parameterKeys.some(k=>!journeyParameterKeys.includes(k))||new Set(parameterKeys).size!==parameterKeys.length)throw Error('INVALID_TEMPLATE_BINDING');
 const payload={milestone,name,language,parameterKeys,enabled};
 await db.query(`INSERT INTO "WhatsAppTemplateBinding" (scope,milestone,name,language,"parameterKeys",enabled,"updatedBy") VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) ON CONFLICT(scope,milestone) DO UPDATE SET name=EXCLUDED.name,language=EXCLUDED.language,"parameterKeys"=EXCLUDED."parameterKeys",enabled=EXCLUDED.enabled,"updatedBy"=EXCLUDED."updatedBy","updatedAt"=now()`,[scope,milestone,name,language,JSON.stringify(parameterKeys),enabled,actor]);
 await db.query(`INSERT INTO "WhatsAppPolicyAudit" (scope,actor,type,payload) VALUES ($1,$2,'TEMPLATE_BINDING',$3::jsonb)`,[scope,actor,JSON.stringify(payload)]);return payload;
}
export async function saveGrant(db:PoolClient,scope:string,input:Record<string,unknown>,actor:string){
 const {customerId,proofReference,validUntil,serviceAllowed,suppressed,confirmedPermission}=input;
 if(typeof input.recipient!=='string'||typeof customerId!=='string'||!customerId.trim()||customerId.length>128||typeof proofReference!=='string'||proofReference.trim().length<8||proofReference.length>256||typeof validUntil!=='string'||!Number.isFinite(Date.parse(validUntil))||Date.parse(validUntil)<=Date.now()||Date.parse(validUntil)>Date.now()+366*86400000||typeof serviceAllowed!=='boolean'||typeof suppressed!=='boolean'||confirmedPermission!==true)throw Error('INVALID_RECIPIENT_GRANT');
 const recipient=normalizeJourneyPhone(input.recipient),existing=(await db.query(`SELECT id FROM "WhatsAppConversation" WHERE scope=$1 AND participant=$2`,[scope,recipient])).rows[0];
 if(existing)await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[scope+':conversation:'+existing.id]);
 const customer=(await db.query(`SELECT id,"telephoneNumber" FROM "NormalCustomer" WHERE id=$1`,[customerId])).rows[0];
 if(!customer||normalizeJourneyPhone(customer.telephoneNumber||'')!==recipient)throw Error('INVALID_CUSTOMER_RECIPIENT_LINK');
 const payload={recipient,customerId,proofReference,validUntil,serviceAllowed,suppressed,proofType:'OPERATOR_VERIFIED'};
 await db.query(`INSERT INTO "WhatsAppRecipientGrant" (scope,recipient,"customerId","serviceAllowed",suppressed,"verifiedAt","validUntil","proofType","proofReference","updatedBy") VALUES ($1,$2,$3,$4,$5,now(),$6,'OPERATOR_VERIFIED',$7,$8) ON CONFLICT(scope,recipient) DO UPDATE SET "customerId"=EXCLUDED."customerId","serviceAllowed"=EXCLUDED."serviceAllowed",suppressed=EXCLUDED.suppressed,"verifiedAt"=now(),"validUntil"=EXCLUDED."validUntil","proofType"=EXCLUDED."proofType","proofReference"=EXCLUDED."proofReference","updatedBy"=EXCLUDED."updatedBy","updatedAt"=now()`,[scope,recipient,customerId,serviceAllowed,suppressed,validUntil,proofReference,actor]);
 if(existing&&(suppressed||!serviceAllowed))await db.query(`UPDATE "WhatsAppServiceIntent" SET status='CANCELLED',"lastReason"='RECIPIENT_SUPPRESSED' WHERE scope=$1 AND "conversationId"=$2 AND status='HELD'`,[scope,existing.id]);
 await db.query(`INSERT INTO "WhatsAppPolicyAudit" (scope,actor,type,payload) VALUES ($1,$2,'RECIPIENT_GRANT',$3::jsonb)`,[scope,actor,JSON.stringify(payload)]);return {saved:true,recipient};
}
