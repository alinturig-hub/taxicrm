import type {InboxMessage} from './inbox-projection';
export type OutboxView={id:string;recipient:string;templateSnapshot:unknown;status:string;providerMessageId:string|null;createdAt:Date};
export function mergeOutbound(messages:InboxMessage[],rows:OutboxView[],phone:string){
 const result=messages.map(m=>({...m}));
 for(const row of rows){const snapshot=row.templateSnapshot as {name?:unknown;language?:unknown};const name=typeof snapshot?.name==='string'?snapshot.name:'unknown';const language=typeof snapshot?.language==='string'?snapshot.language:'unknown';
 const content=`Template: ${name} (${language})`;
 const match=row.providerMessageId?result.find(m=>m.direction==='OUTBOUND'&&m.phoneNumberId===phone&&m.id===row.providerMessageId):undefined;
 if(match){match.text=content;match.type='template-reference';continue;}
 result.push({id:row.providerMessageId||row.id,participant:row.recipient,phoneNumberId:phone,direction:'OUTBOUND',timestamp:row.createdAt.toISOString(),text:content,type:'template-reference',status:row.status});
 }
 return result.sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
}
