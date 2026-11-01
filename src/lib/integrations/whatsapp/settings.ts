export class WhatsAppError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function whatsappSettings(env: NodeJS.ProcessEnv = process.env) {
  const appId = env.META_WHATSAPP_APP_ID || "";
  const wabaId = env.META_WHATSAPP_WABA_ID || "";
  const graphVersion = env.META_WHATSAPP_GRAPH_VERSION || "";
  const token = env.META_WHATSAPP_ACCESS_TOKEN || "";
  const numeric = (value: string) => /^\d{5,32}$/.test(value);
  const issues = [
    ...(!numeric(appId) ? ["Configure a valid Meta App ID."] : []),
    ...(!numeric(wabaId) ? ["Configure a valid WhatsApp Business Account ID (WABA), not a phone number ID."] : []),
    ...(!/^v\d{1,3}\.\d{1,2}$/.test(graphVersion) ? ["Configure the Graph API version supported by your Meta app."] : []),
    ...(!/^[\x21-\x7e]{20,4096}$/.test(token) ? ["Configure the access token using secure server settings."] : []),
  ];
  return {
    provider: "META" as const,
    appId: numeric(appId) ? appId : "",
    wabaId: numeric(wabaId) ? wabaId : "",
    graphVersion: /^v\d{1,3}\.\d{1,2}$/.test(graphVersion) ? graphVersion : "",
    hasToken: /^[\x21-\x7e]{20,4096}$/.test(token),
    enabled: env.META_WHATSAPP_ENABLED === "true",
    ready: issues.length === 0,
    issues,
    templateSubmissionEnabled: false,
    messagingEnabled: false,
  };
}
export function whatsappCredentials(env: NodeJS.ProcessEnv = process.env) {
  const settings = whatsappSettings(env);
  if (!settings.enabled) throw new WhatsAppError("WHATSAPP_DISABLED", 503);
  if (!settings.ready) throw new WhatsAppError("WHATSAPP_SETUP_REQUIRED", 503);
  return { ...settings, accessToken: env.META_WHATSAPP_ACCESS_TOKEN! };
}
