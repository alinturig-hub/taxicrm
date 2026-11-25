import { localEmailModel } from "@/lib/marketing/email/generate";
import { normalizeLine, type FreephonePeriod } from "./copilot-booking-scope";
import { resolveAgentConfig } from "./owner-agent/policy";
import { connectionFromProvider, readProvider } from "./owner-agent/provider-store";
import { ollamaOriginAllowed, type ModelConnection } from "./owner-agent/providers";

type Scope = { line: string; period: FreephonePeriod };

async function configuredOllama(): Promise<ModelConnection | null> {
  try {
    const provider = connectionFromProvider(await readProvider(resolveAgentConfig()));
    if (provider?.provider === "OLLAMA") return provider;
  } catch {
    // The owner-agent module can be unavailable while a local model is configured.
  }

  return localEmailModel();
}

export async function planFreephoneScope(question: string, scope: Scope, transport: typeof fetch = fetch) {
  try {
    const configured = process.env.TAXICRM_COPILOT_OLLAMA_URL;
    const provider = configured ? null : await configuredOllama();
    if (!configured && provider?.provider !== "OLLAMA") return null;
    const url = new URL(configured || provider!.endpoint);
    if (url.username || url.password || url.search || url.hash || !ollamaOriginAllowed(url, process.env)) return null;
    url.pathname = "/api/chat";
    const response = await transport(url, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
      headers: { "content-type": "application/json", ...(provider?.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {}) },
      body: JSON.stringify({
        model: provider?.model || process.env.TAXICRM_COPILOT_OLLAMA_MODEL || "qwen3:30b-a3b",
        stream: false,
        think: false,
        format: "json",
        options: { temperature: 0, num_predict: 100 },
        messages: [
          { role: "system", content: 'Extract the literal Freephone location and requested period. Return only JSON with keys "line" and "period". Period must be today, yesterday, this week, last week, this month, or last month. Do not answer the question or remove any filter.' },
          { role: "user", content: question },
        ],
      }),
    });
    if (!response.ok) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_000) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const data = JSON.parse(text + decoder.decode());
    if (data?.message?.tool_calls?.length || typeof data?.message?.content !== "string" || data.message.content.length > 1000) return null;
    const plan = JSON.parse(data.message.content);
    if (typeof plan?.line !== "string" || plan.line.length > 120 || plan.period !== scope.period ||
      normalizeLine(plan.line) !== normalizeLine(scope.line)) return null;
    return { line: plan.line, period: scope.period };
  } catch {
    return null;
  }
}
