import { extraTemplateComponents, type ImageHeader, type TemplateButton } from "./template-components";
import { WhatsAppError, whatsappCredentials } from "./settings";
export type TemplateDraft = { name: string; language: string; category: string; text: string; samples: string[]; header?: ImageHeader; buttons?: TemplateButton[] };
export function templatePreview(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new WhatsAppError("INVALID_DRAFT");
  const draft = input as Record<string, unknown>;
  if (Object.keys(draft).some(k => !["name", "language", "category", "text", "samples", "header", "buttons"].includes(k))) throw new WhatsAppError("INVALID_DRAFT");
  const { name, language, category, text, samples } = draft;
  if (typeof name !== "string" || !/^[a-z0-9_]{1,512}$/.test(name)) throw new WhatsAppError("INVALID_TEMPLATE_NAME");
  if (typeof language !== "string" || !["en_GB", "en_US", "ro"].includes(language)) throw new WhatsAppError("UNSUPPORTED_LANGUAGE");
  if (category !== "UTILITY" && category !== "MARKETING") throw new WhatsAppError("UNSUPPORTED_CATEGORY");
  if (typeof text !== "string" || !text.trim() || text.length > 1024 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new WhatsAppError("INVALID_TEMPLATE_TEXT");
  const matches = Array.from(text.matchAll(/\{\{([1-9]\d*)\}\}/g));
  if (/[{}]/.test(text.replace(/\{\{([1-9]\d*)\}\}/g, ""))) throw new WhatsAppError("INVALID_VARIABLES");
  const indexes = Array.from(new Set(matches.map(m => Number(m[1])))).sort((a, b) => a - b);
  if (indexes.length > 10 || indexes.some((n, i) => n !== i + 1)) throw new WhatsAppError("VARIABLES_MUST_BE_SEQUENTIAL");
  if (!Array.isArray(samples) || samples.length !== indexes.length || samples.some(v => typeof v !== "string" || !v.trim() || v.length > 200 || /[\x00-\x1f]/.test(v))) throw new WhatsAppError("VARIABLE_SAMPLES_REQUIRED");
  const examples = samples as string[];
  const extra = extraTemplateComponents(draft.header, draft.buttons);
  return {
    payload: { name, language, category, components: [...extra.filter(c=>c.type === "HEADER"), { type: "BODY", text, ...(examples.length ? { example: { body_text: [examples] } } : {}) }, ...extra.filter(c=>c.type === "BUTTONS")] },
    renderedText: text.replace(/\{\{([1-9]\d*)\}\}/g, (_, n) => examples[Number(n) - 1]),
    submitted: false,
    notice: "Local preview only. Nothing has been saved or submitted to Meta. Final approval and category are determined by Meta.",
  };
}
export async function boundedJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new WhatsAppError("META_INVALID_RESPONSE", 502);
  let size = 0, text = ""; const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 262144) { await reader.cancel(); throw new WhatsAppError("META_RESPONSE_TOO_LARGE", 502); }
    text += decoder.decode(value, { stream: true });
  }
  try { return JSON.parse(text + decoder.decode()) as Record<string, unknown>; }
  catch { throw new WhatsAppError("META_INVALID_RESPONSE", 502); }
}
export async function listTemplates(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  const config = whatsappCredentials(env);
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${config.wabaId}/message_templates`);
  url.searchParams.set("fields", "id,name,status,category,language,components");
  url.searchParams.set("limit", "25");
  try {
    const response = await fetcher(url, { method: "GET", headers: { Authorization: `Bearer ${config.accessToken}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new WhatsAppError(response.status === 401 || response.status === 403 ? "META_ACCESS_DENIED" : response.status === 429 ? "META_RATE_LIMITED" : "META_REQUEST_FAILED", 502);
    const payload = await boundedJson(response);
    if (!Array.isArray(payload.data) || payload.data.length > 25) throw new WhatsAppError("META_INVALID_RESPONSE", 502);
    const clean = (value: unknown, max = 128) => typeof value === "string" ? value.slice(0, max) : "";
    const templates = payload.data.map((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new WhatsAppError("META_INVALID_RESPONSE", 502);
      const item = value as Record<string, unknown>;
      return { id: clean(item.id), name: clean(item.name, 512), status: clean(item.status), category: clean(item.category), language: clean(item.language),
        body: Array.isArray(item.components) ? item.components.filter(c => c && typeof c === "object" && c.type === "BODY").map(c => clean(c.text, 4096)).join("\n").slice(0, 4096) : "" };
    });
    return { templates, hasMore: Boolean(payload.paging && typeof payload.paging === "object" && (payload.paging as Record<string, unknown>).next), fetchedAt: new Date().toISOString(), wabaId: config.wabaId };
  } catch (error) {
    if (error instanceof WhatsAppError) throw error;
    // Never echo raw Meta responses, bearer tokens, URLs or network errors.
    throw new WhatsAppError("META_CONNECTION_FAILED", 502);
  }
}

/** Explicit operator submission only. Never retry ambiguous POST outcomes. */
export async function submitTemplate(input: unknown, env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch) {
  const config = whatsappCredentials(env);
  if (!config.templateSubmissionEnabled) throw new WhatsAppError("TEMPLATE_SUBMISSION_DISABLED", 503);
  const { payload } = templatePreview(input);
  try {
    const response = await fetcher(`https://graph.facebook.com/${config.graphVersion}/${config.wabaId}/message_templates`, {
      method: "POST", headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new WhatsAppError(response.status === 401 || response.status === 403 ? "META_ACCESS_DENIED" : response.status === 429 ? "META_RATE_LIMITED" : "TEMPLATE_SUBMISSION_REJECTED", 502);
    const result = await boundedJson(response);
    if (typeof result.id !== "string" || !/^\d{1,64}$/.test(result.id)) throw new WhatsAppError("TEMPLATE_SUBMISSION_UNCONFIRMED", 502);
    return { id: result.id, status: typeof result.status === "string" ? result.status.slice(0,64) : "UNKNOWN", submitted: true,
      notice: "Submitted to Meta. Acceptance is not approval; refresh the template list to check the current status. No WhatsApp message was sent." };
  } catch (error) {
    if (error instanceof WhatsAppError) throw error;
    throw new WhatsAppError("TEMPLATE_SUBMISSION_UNCONFIRMED", 502);
  }
}
