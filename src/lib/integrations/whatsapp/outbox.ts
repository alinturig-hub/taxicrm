import {createHash,randomUUID} from "node:crypto";
export type OutboundDraft={connectionKey:string;operationKey:string;actorUserId:string;recipient:string;templateSnapshot:Record<string,unknown>;purpose:"MARKETING"|"SERVICE";eligibilityEvidence:Record<string,unknown>};
type Row={id:string;requestHash:string;status:string};
export type OutboxTransaction={query:(sql:string,values:unknown[])=>Promise<{rows:Row[]}>};
function stable(x:unknown):string{
 if(x===null||typeof x!=="object")return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
 const r=x as Record<string,unknown>;return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+stable(r[k])).join(',')+'}';
}
/** Caller provides verified connection scope, actor and server-evaluated eligibility. */
export async function enqueueOutbound(tx:OutboxTransaction,input:OutboundDraft){
 if(!input.connectionKey.trim()||!input.operationKey.trim()||!input.actorUserId.trim()||!/^\+[1-9]\d{7,14}$/.test(input.recipient))throw Error("INVALID_OUTBOUND_DRAFT");
 const hash=createHash('sha256').update(stable({recipient:input.recipient,template:input.templateSnapshot,purpose:input.purpose})).digest('hex');
 await tx.query(`INSERT INTO "WhatsAppOutboundMessage" ("id","connectionKey","operationKey","requestHash","actorUserId","recipient","templateSnapshot","purpose","eligibilityEvidence") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb) ON CONFLICT ("connectionKey","operationKey") DO NOTHING`,[randomUUID(),input.connectionKey,input.operationKey,hash,input.actorUserId,input.recipient,JSON.stringify(input.templateSnapshot),input.purpose,JSON.stringify(input.eligibilityEvidence)]);
 const row=(await tx.query(`SELECT "id","requestHash","status" FROM "WhatsAppOutboundMessage" WHERE "connectionKey"=$1 AND "operationKey"=$2`,[input.connectionKey,input.operationKey])).rows[0];
 if(!row||row.requestHash!==hash)throw Error("OUTBOUND_IDEMPOTENCY_CONFLICT");
 return row;
}
export async function claimOutbound(tx:OutboxTransaction,connectionKey:string,id:string){
 return (await tx.query(`UPDATE "WhatsAppOutboundMessage" SET "status"='SENDING',"claimedAt"=now(),"attemptCount"=1 WHERE "connectionKey"=$1 AND "id"=$2 AND "status"='QUEUED' AND "attemptCount"=0 RETURNING "id","requestHash","status"`,[connectionKey,id])).rows[0]||null;
}
/** Crash recovery never requeues a possibly transmitted operation. */
export async function markStaleOutboundUnknown(tx:OutboxTransaction,connectionKey:string,cutoff:Date){
 if(!Number.isFinite(cutoff.getTime()))throw Error('INVALID_CUTOFF');
 return tx.query(`UPDATE "WhatsAppOutboundMessage" SET "status"='UNKNOWN',"finishedAt"=now() WHERE "connectionKey"=$1 AND "status"='SENDING' AND "claimedAt"<$2 RETURNING "id","requestHash","status"`,[connectionKey,cutoff]);
}
