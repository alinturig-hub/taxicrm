import { WhatsAppError, whatsappSettings } from "./settings";
import { listTemplates } from "./templates";

export type WhatsAppProvider = "META" | "COMBOT";
export function parseProvider(value: unknown): WhatsAppProvider {
  if (value !== "META" && value !== "COMBOT") throw new WhatsAppError("INVALID_WHATSAPP_PROVIDER");
  return value;
}
/** Exactly one outbound transport per connection/phone. Never silently fall back. */
export function providerCapabilities(provider: WhatsAppProvider, env: NodeJS.ProcessEnv = process.env) {
  if (provider === "META") {
    const meta = whatsappSettings(env);
    return { provider, configured: meta.ready, enabled: meta.enabled, canListTemplates: meta.ready && meta.enabled,
      canSend: false, canReceive: false, blocker: meta.ready ? "MESSAGING_NOT_IMPLEMENTED" : "META_SETUP_REQUIRED" };
  }
  return { provider, configured: false, enabled: false, canListTemplates: false,
    canSend: false, canReceive: false, blocker: "COMBOT_API_CONTRACT_REQUIRED" };
}
export async function providerTemplates(provider: WhatsAppProvider, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  if (provider === "COMBOT") throw new WhatsAppError("COMBOT_API_CONTRACT_REQUIRED", 503);
  return listTemplates(env, fetcher);
}
export type TransportMessage = { workspaceKey: string; connectionId: string; idempotencyKey: string; recipient: string; templateName: string };
export async function sendProviderMessage(provider: WhatsAppProvider, message: TransportMessage): Promise<never> {
  parseProvider(provider);
  if (!message.workspaceKey.trim() || !message.connectionId.trim() || !message.idempotencyKey.trim() || !/^\+[1-9]\d{7,14}$/.test(message.recipient)) {
    throw new WhatsAppError("INVALID_OUTBOUND_MESSAGE");
  }
  throw new WhatsAppError(provider === "COMBOT" ? "COMBOT_API_CONTRACT_REQUIRED" : "WHATSAPP_SENDING_NOT_ACTIVATED", 503);
}
