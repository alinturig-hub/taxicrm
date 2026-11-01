import { WhatsAppError } from "./settings";
/** Request plans only: no fetch, token, webhook mutation or campaign trigger. */
function id(value: string) {
  if (!/^\d{5,32}$/.test(value)) throw new WhatsAppError("INVALID_COMBOT_ID");
  return value;
}
export function combotTemplateList(wabaId: string, version: string) {
  if (!/^v\d{1,3}\.\d{1,2}$/.test(version)) throw new WhatsAppError("INVALID_COMBOT_VERSION");
  return { method: "GET", path: `/api/meta/${version}/${id(wabaId)}/message_templates?limit=10&offset=0`, authentication: "BEARER" };
}
export function combotTemplateMessage(input: {phoneNumberId:string; version:string; recipient:string; name:string; language:string; parameters:string[]}) {
  combotTemplateList(input.phoneNumberId,input.version);
  if (!/^\+[1-9]\d{7,14}$/.test(input.recipient) || !/^[a-z0-9_]{1,512}$/.test(input.name) || !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(input.language) || input.parameters.length>10 || input.parameters.some(x=> !x.trim() || x.length>1024)) throw new WhatsAppError("INVALID_COMBOT_TEMPLATE_MESSAGE");
  return { method:"POST", path:`/api/meta/${input.version}/${input.phoneNumberId}/messages`, authentication:"BEARER", body:{messaging_product:"whatsapp",recipient_type:"individual",to:input.recipient.slice(1),type:"template",template:{name:input.name,language:{policy:"deterministic",code:input.language},components:input.parameters.length?[{type:"body",parameters:input.parameters.map(text=>({type:"text",text}))}]:[]}} };
}
export const combotDocumentedContract = {
  documentation:"https://documenter.getpostman.com/view/14215086/2sA3e2hAeY",
  campaignAuthentication:"API-KEY",
  campaignPath:"/crm/campaign",
  webhookPath:"/v2/webhook",
  events:["incoming","sent","delivered","read","failed","deleted","template","account","phone_number","outgoing"],
  unresolved:["account-specific domain, crmapi_domain and base-url", "webhook signature and payload contract", "rate limits", "send idempotency and timeout reconciliation", "response schemas"],
} as const;
