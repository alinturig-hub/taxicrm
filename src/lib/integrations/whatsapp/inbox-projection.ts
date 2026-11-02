export type InboxMessage={id:string;phoneNumberId:string;participant:string;direction:"INBOUND"|"OUTBOUND";timestamp:string|null;text:string;type:string;status:string};
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
const arr=(x:unknown)=>Array.isArray(x)?x:[];
const str=(x:unknown,max=4096)=>typeof x==="string"?x.slice(0,max):"";
function time(x:unknown){const n=Number(x);return Number.isFinite(n)&&n>0&&n<8640000000000?new Date(n*1000).toISOString():null;}
/** Read model derived from durable raw envelopes; never changes booking/customer identity. */
export function projectInbox(rawBodies:string[],wabaId:string){
 const messages=new Map<string,InboxMessage>();
 const statuses=new Map<string,{rank:number;name:string;timestamp:string|null;participant:string;phone:string}>();
 let invalid=0;
 for(const raw of rawBodies){let envelope:Record<string,unknown>;try{envelope=obj(JSON.parse(raw));}catch{invalid++;continue;}
 for(const e of arr(envelope.entry)){const entry=obj(e);if(entry.id!==wabaId)continue;
 for(const change of arr(entry.changes)){const c=obj(change);if(c.field!=="messages")continue;const v=obj(c.value),phone=str(obj(v.metadata).phone_number_id,64);if(!phone)continue;
 for(const item of arr(v.messages)){const m=obj(item),id=str(m.id,256),participant=str(m.from_user_id||m.from,128);if(!id||!participant)continue;const key=phone+":"+id;
 if(!messages.has(key))messages.set(key,{id,phoneNumberId:phone,participant,direction:"INBOUND",timestamp:time(m.timestamp),text:str(obj(m.text).body)||str(obj(obj(m.interactive).button_reply).title)||str(obj(obj(m.interactive).list_reply).title)||str(obj(m.button).text),type:str(m.type,32)||"unknown",status:"RECEIVED"});
 }
 for(const item of arr(v.statuses)){const s=obj(item),id=str(s.id,256),name=str(s.status,32);if(!id)continue;const rank:Record<string,number>={failed:0,sent:1,delivered:2,read:3};if(!(name in rank))continue;const key=phone+":"+id,current=statuses.get(key);if(!current||rank[name]>current.rank)statuses.set(key,{rank:rank[name],name:name.toUpperCase(),timestamp:time(s.timestamp),participant:str(s.recipient_user_id||s.recipient_id,128),phone});
 }
 }
 }
 }
 for(const [key,s] of Array.from(statuses.entries())){if(messages.has(key))continue;messages.set(key,{id:key.slice(s.phone.length+1),phoneNumberId:s.phone,participant:s.participant||"Unknown recipient",direction:"OUTBOUND",timestamp:s.timestamp,text:"",type:"status",status:s.name});}
 return {messages:Array.from(messages.values()).sort((a,b)=>(b.timestamp||"").localeCompare(a.timestamp||"")),invalid};
}
