"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
type Conversation={id:string;participant:string;mode:'AUTOMATED'|'OPERATOR';revision:number;lastMessageText?:string|null};
type Message={id:string;direction:string;status:string;content:{text?:string;type?:string};occurredAt:string|null};
export default function WhatsAppSharedInbox({onReady}:{onReady?:()=>void}){
 const [conversations,setConversations]=useState<Conversation[]>([]),[active,setActive]=useState<Conversation|null>(null),[messages,setMessages]=useState<Message[]>([]),[cursor,setCursor]=useState<string|null>(null),[after,setAfter]=useState<string|null>(null),[enabled,setEnabled]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[loading,setLoading]=useState(false);
 const requestNumber=useRef({value:0}),readyCallback=useRef(onReady);
 readyCallback.current=onReady;
 const list=useCallback(async(afterId='')=>{
  const requestId=++requestNumber.current.value;setLoading(true);setError('');
  try{
   const params=new URLSearchParams({q:query});if(afterId)params.set('after',afterId);
   const r=await fetch('/api/dashboard/marketing/whatsapp/conversations?'+params,{cache:'no-store'});
   if(requestId!==requestNumber.current.value)return;
   if(r.status===503){setError('Shared history unavailable.');return;}
   if(!r.ok)throw Error('Shared history unavailable.');
   const d=await r.json();if(requestId!==requestNumber.current.value)return;
   setEnabled(true);readyCallback.current?.();
   setConversations(old=>afterId?Array.from(new Map([...old,...d.conversations].map((c:Conversation)=>[c.id,c])).values()):d.conversations);
   setAfter(d.next_cursor??null);
  }finally{if(requestId===requestNumber.current.value)setLoading(false);}
 },[query]);
 useEffect(()=>{const requests=requestNumber.current;void list().catch(()=>setError('Shared history unavailable.'));return()=>{requests.value++;};},[list]);
 async function open(c:Conversation,older=false){setBusy(true);setError('');try{const r=await fetch('/api/dashboard/marketing/whatsapp/conversations?id='+encodeURIComponent(c.id)+(older&&cursor?'&cursor='+cursor:''),{cache:'no-store'});if(!r.ok)throw Error('Could not load conversation.');const d=await r.json();setActive(d.conversation);setMessages(old=>older?[...old,...d.messages]:d.messages);setCursor(d.next_cursor);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function change(){if(!active)return;setBusy(true);setError('');try{const r=await fetch('/api/dashboard/marketing/whatsapp/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversation_id:active.id,command_id:crypto.randomUUID(),revision:active.revision,mode:active.mode==='OPERATOR'?'AUTOMATED':'OPERATOR'})});if(!r.ok)throw Error(r.status===409?'Conversation changed. Refresh before trying again.':'Could not change conversation mode.');await open(active);await list();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!enabled)return error?<p role="alert">{error}</p>:null;
 return <section className="space-y-4 rounded-2xl border border-app-border p-5"><h2 className="text-xl font-semibold">Shared conversation history</h2><p className="text-sm text-app-muted">Operator takeover pauses automatic notifications. Release is explicit; old notifications stay cancelled. Provider sending requires approved templates and verified recipient permission.</p>{error&&<p role="alert">{error}</p>}<form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();if(query===search.trim())void list().catch(()=>setError('Could not search.'));else setQuery(search.trim());}}><input aria-label="Search conversations by phone number" placeholder="Search phone number" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)} className="rounded border border-app-border bg-transparent p-2"/><button disabled={loading} type="submit">Search</button></form><button disabled={busy||loading} onClick={()=>void list().catch(()=>setError('Could not refresh.'))}>Refresh conversations</button><div className="grid gap-4 lg:grid-cols-[240px_1fr]"><nav aria-label="Shared conversations">{conversations.map(c=><button disabled={busy} className="block w-full rounded border border-app-border p-3 text-left" key={c.id} onClick={()=>void open(c)}>{c.participant} · {c.mode}{c.lastMessageText&&<span className="mt-1 block truncate text-sm text-app-muted">{c.lastMessageText}</span>}</button>)}{!loading&&conversations.length===0&&<p>No conversations found.</p>}{after&&<button disabled={loading} onClick={()=>void list(after).catch(()=>setError('Could not load more.'))}>{loading?'Loading…':'More conversations'}</button>}</nav><div>{active&&<><p>{active.participant} · {active.mode}</p><button disabled={busy} className="my-3 rounded border border-app-border p-3" onClick={()=>void change()}>{active.mode==='OPERATOR'?'Release to automation':'Take over conversation'}</button><button disabled={busy} className="ml-3" onClick={()=>void open(active)}>Refresh</button></>}{messages.map(m=><article className="mb-3 rounded border border-app-border p-4" key={m.id}><p className="text-xs">{m.direction} · {m.status}</p><p className="whitespace-pre-wrap break-words">{m.content.text||`[${m.content.type||'message'}]`}</p></article>)}{cursor&&active&&<button disabled={busy} onClick={()=>void open(active,true)}>Older messages</button>}</div></div></section>;
}
