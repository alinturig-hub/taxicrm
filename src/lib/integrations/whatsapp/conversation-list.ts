// Keyset pagination follows the latest recorded message, independent of random conversation IDs.
export function conversationListQuery(scope:string, search='', after='') {
 if(search.length>100)throw Error('INVALID_SEARCH');
 let boundary:{lastMessageId:string;id:string}|null=null;
 if(after){
  try{boundary=JSON.parse(Buffer.from(after,'base64url').toString('utf8'));}catch{throw Error('INVALID_CURSOR');}
  if(!boundary||typeof boundary.id!=='string'||!boundary.id||boundary.id.length>200||typeof boundary.lastMessageId!=='string'||!/^\d{1,19}$/.test(boundary.lastMessageId)||BigInt(boundary.lastMessageId)>BigInt('9223372036854775807'))throw Error('INVALID_CURSOR');
 }
 const normalized=search.trim().replace(/[\s()+.-]/g,'');
 return {text:`SELECT c.id,c.participant,c.mode,c.revision,
   COALESCE(last.id,0)::text AS "lastMessageId",last.content->>'text' AS "lastMessageText"
 FROM "WhatsAppConversation" c
 LEFT JOIN LATERAL (
   SELECT m.id,m.content FROM "WhatsAppMessage" m
   WHERE m.scope=c.scope AND m."conversationId"=c.id ORDER BY m.id DESC LIMIT 1
 ) last ON true
 WHERE c.scope=$1 AND ($2='' OR strpos(lower(regexp_replace(c.participant,'[[:space:]()+.-]','','g')),lower($2))>0)
 AND ($3::bigint IS NULL OR (COALESCE(last.id,0),c.id)<($3::bigint,$4::text))
 ORDER BY COALESCE(last.id,0) DESC,c.id DESC LIMIT 51`,values:[scope,normalized,boundary?.lastMessageId??null,boundary?.id??null]};
}
export function conversationCursor(row:{id:string;lastMessageId:string}) {
 return Buffer.from(JSON.stringify({lastMessageId:row.lastMessageId,id:row.id})).toString('base64url');
}
