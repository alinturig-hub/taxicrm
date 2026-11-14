import { AgentError } from "./policy";
export const providerIds = ["NONE", "OPENAI", "ANTHROPIC", "OLLAMA"] as const;
export type ProviderId = typeof providerIds[number];
export type ProviderInput = { provider: ProviderId; model: string; baseUrl: string; enabled: boolean; cloudConsent: boolean; apiKey?: string; clearKey: boolean };
export type ModelConnection = { provider: Exclude<ProviderId, "NONE">; endpoint: string; model: string; apiKey: string };
export function parseProviderInput(raw: unknown, env: Readonly<Record<string, string | undefined>> = process.env): ProviderInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AgentError("INVALID_PROVIDER_SETTINGS");
  const r = raw as Record<string, unknown>;
  if (Object.keys(r).some(k => !["provider", "model", "baseUrl", "enabled", "cloudConsent", "apiKey", "clearKey"].includes(k)) || !providerIds.includes(r.provider as ProviderId) || typeof r.enabled !== "boolean" || typeof r.cloudConsent !== "boolean" || typeof r.clearKey !== "boolean") throw new AgentError("INVALID_PROVIDER_SETTINGS");
  const provider = r.provider as ProviderId;
  if (r.apiKey !== undefined && (typeof r.apiKey !== "string" || r.apiKey.length > 2048 || (r.apiKey && !/^[\x21-\x7e]+$/.test(r.apiKey)))) throw new AgentError("INVALID_PROVIDER_KEY");
  if (r.clearKey && r.apiKey) throw new AgentError("INVALID_PROVIDER_KEY");
  if (provider === "NONE") {
    if (r.enabled || r.apiKey || r.model || r.baseUrl) throw new AgentError("INVALID_PROVIDER_SETTINGS");
    return { provider, model: "", baseUrl: "", enabled: false, cloudConsent: false, clearKey: true };
  }
  if (typeof r.model !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,99}$/.test(r.model)) throw new AgentError("MODEL_ID_REQUIRED");
  let baseUrl = provider === "OPENAI" ? "https://api.openai.com/v1" : "https://api.anthropic.com/v1";
  if (provider !== "OLLAMA" && r.baseUrl && r.baseUrl !== baseUrl) throw new AgentError("PROVIDER_ENDPOINT_FIXED");
  if (provider === "OLLAMA") {
    if (typeof r.baseUrl !== "string") throw new AgentError("OLLAMA_ENDPOINT_REQUIRED");
    try {
      const u = new URL(r.baseUrl);
      if (u.username || u.password || u.search || u.hash || !["", "/", "/v1", "/v1/"].includes(u.pathname) || (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))) throw Error();
      const allowed = JSON.parse(env.TAXICRM_AGENT_OLLAMA_ORIGINS || "[]");
      if (!Array.isArray(allowed) || !allowed.includes(u.origin)) throw Error();
      baseUrl = u.origin + "/v1";
    } catch { throw new AgentError("OLLAMA_ORIGIN_NOT_APPROVED"); }
  }
  if (r.enabled && provider !== "OLLAMA" && !r.cloudConsent) throw new AgentError("CLOUD_QUESTION_CONSENT_REQUIRED");
  return { provider, model: r.model, baseUrl, enabled: r.enabled, cloudConsent: r.cloudConsent, ...(r.apiKey === undefined ? {} : { apiKey: r.apiKey as string }), clearKey: r.clearKey };
}
export function endpointFor(provider: ProviderId, baseUrl: string) {
  return baseUrl + (provider === "ANTHROPIC" ? "/messages" : "/chat/completions");
}
