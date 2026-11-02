import {createHash,randomUUID} from "node:crypto";
export class InboxError extends Error {constructor(public code:string,public status:number){super(code);}}
export type InboxRecord={id:string;connectionKey:string;bodyHash:string;rawBody:string};
export async function receiveMetaEnvelope(raw:Uint8Array,wabaId:string|undefined,save:(record:InboxRecord)=>Promise<void>){
 if(!wabaId||!/^\d{5,32}$/.test(wabaId))throw new InboxError("WABA_NOT_CONFIGURED",503);
 let text:string,payload:unknown;
 try{text=new TextDecoder("utf-8",{fatal:true}).decode(raw);payload=JSON.parse(text);}catch{throw new InboxError("INVALID_JSON",400);}
 if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new InboxError("INVALID_ENVELOPE",400);
 const envelope=payload as {object?:unknown;entry?:unknown};
 if(envelope.object!=="whatsapp_business_account"||!Array.isArray(envelope.entry)||envelope.entry.length===0||envelope.entry.length>100)throw new InboxError("INVALID_ENVELOPE",400);
 for(const entry of envelope.entry){
 if(!entry||typeof entry!=="object"||Array.isArray(entry)||entry.id!==wabaId)throw new InboxError("WABA_MISMATCH",403);
 if(!Array.isArray(entry.changes)||entry.changes.length>100)throw new InboxError("INVALID_ENVELOPE",400);
 }
 const bodyHash=createHash("sha256").update(raw).digest("hex");
 // Acknowledge only after the durable insert (or confirmed duplicate) succeeds.
 await save({id:randomUUID(),connectionKey:`META:${wabaId}`,bodyHash,rawBody:text!});
 return {accepted:true};
}
