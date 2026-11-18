/** Read-only credential check: never sends an email or includes a recipient. */
export async function checkSendgridKey(apiKey: string, transport: typeof fetch = fetch) {
  try {
    const response = await transport("https://api.sendgrid.com/v3/scopes", { method: "GET", headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    if (response.status === 401 || response.status === 403) return { state: "NOT_VERIFIED" as const };
    if (!response.ok || !response.body) return { state: "UNAVAILABLE" as const };
    const reader = response.body.getReader(); let size = 0, body = ""; const decoder = new TextDecoder();
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 65536) { await reader.cancel(); return { state: "UNAVAILABLE" as const }; } body += decoder.decode(part.value, { stream: true }); }
    const data = JSON.parse(body + decoder.decode());
    if (!data || !Array.isArray(data.scopes) || !data.scopes.every((x: unknown) => typeof x === "string")) return { state: "UNAVAILABLE" as const };
    return { state: "VERIFIED" as const, canSend: data.scopes.includes("mail.send") };
  } catch { return { state: "UNAVAILABLE" as const }; }
}
