/** Only records explicitly marked MARKETING in this connection; no inferred reply/customer/campaign associations. */
export function marketingHistoryQuery(scope:string,cursor=''){
 let before:{at:string;id:string}|null=null;
 if(cursor){try{before=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'))}catch{throw Error('INVALID_CURSOR')}
  if(!before||typeof before.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(before.id)||typeof before.at!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(before.at)||!Number.isFinite(Date.parse(before.at)))throw Error('INVALID_CURSOR');}
 return {text:`SELECT o.id,o.recipient,o."createdAt",to_char(o."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorAt",o.status AS "outboxStatus",o."templateSnapshot"->>'name' AS "templateName",m.status AS "messageStatus",left(m.content->>'text',4096) AS "messageText",COALESCE(char_length(m.content->>'text')>4096,false) AS "messageTruncated"
 FROM "WhatsAppOutboundMessage" o LEFT JOIN "WhatsAppMessage" m ON m.scope=o."connectionKey" AND m."providerMessageId"=o."providerMessageId" AND m.direction='OUTBOUND'
 WHERE o."connectionKey"=$1 AND o.purpose='MARKETING' AND ($2::timestamptz IS NULL OR (o."createdAt",o.id)<($2::timestamptz,$3::text))
 ORDER BY o."createdAt" DESC,o.id DESC LIMIT 51`,values:[scope,before?.at??null,before?.id??null]};
}
export function marketingHistoryCursor(row:{id:string;cursorAt:string}){return Buffer.from(JSON.stringify({id:row.id,at:row.cursorAt})).toString('base64url')}
