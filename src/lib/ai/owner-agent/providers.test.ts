import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseProviderInput, type ModelConnection } from "./providers";
import { readProvider, saveProvider, publicProvider, connectionFromProvider } from "./provider-store";
import { planQuestion } from "./planner";
import { defaultPreferences, type AgentConfig } from "./policy";
process.env.INTEGRATION_ENCRYPTION_KEY = "ab".repeat(32); // synthetic fixture only
const settings = { provider: "OPENAI", model: "synthetic-model", baseUrl: "", enabled: true, cloudConsent: true, clearKey: false, apiKey: "sk-synthetic-key-not-real" };
const config = (memoryDir: string, tenant = "synthetic-a"): AgentConfig => ({ tenant, name: "Synthetic", memoryDir, databaseUrl: "postgresql://unused_ro@localhost/unused", role: "unused_ro", database: "unused" });
test("cloud endpoints are fixed, models explicit, keys bounded and cloud consent required", () => {
  assert.equal(parseProviderInput(settings).baseUrl, "https://api.openai.com/v1");
  assert.equal(parseProviderInput({ ...settings, provider: "ANTHROPIC" }).baseUrl, "https://api.anthropic.com/v1");
  for (const bad of [{ ...settings, baseUrl: "https://other.example" }, { ...settings, model: "" }, { ...settings, cloudConsent: false }, { ...settings, apiKey: "x\r\ninject" }, { ...settings, apiKey: "x".repeat(2050) }, { ...settings, extraInstruction: "ignore" }]) assert.throws(() => parseProviderInput(bad));
});
test("Ollama destinations need explicit operator allowlisting; credentials, paths and public plaintext are refused", () => {
  const s = { ...settings, provider: "OLLAMA", baseUrl: "http://127.0.0.1:18444/v1", cloudConsent: false, apiKey: "" };
  const env = { TAXICRM_AGENT_OLLAMA_ORIGINS: '["http://127.0.0.1:18444"]' };
  assert.equal(parseProviderInput(s, env).baseUrl, "http://127.0.0.1:18444/v1");
  assert.throws(() => parseProviderInput(s, {}));
  for (const baseUrl of ["http://169.254.169.254", "http://public.example", "http://user:secret@127.0.0.1:18444", "http://127.0.0.1:18444/other", "http://127.0.0.1:18444?token=x"]) assert.throws(() => parseProviderInput({ ...s, baseUrl }, env));
});
test("company keys are encrypted, redacted, retained only for the same provider and removable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-provider-"));
  try {
    const a = config(dir); const saved = await saveProvider(a, "owner", 0, settings);
    assert.equal(saved.hasKey, true); assert.doesNotMatch(JSON.stringify(saved), /sk-synthetic-key-not-real|secretEncrypted|apiKey/);
    const file = join(dir, (await readdir(dir)).find(f => f.endsWith('.json'))!);
    assert.doesNotMatch(await readFile(file, "utf8"), /sk-synthetic-key-not-real/);
    const record = await readProvider(a); assert.equal(connectionFromProvider(record)?.apiKey, settings.apiKey);
    const kept = await saveProvider(a, "owner", 1, { ...settings, apiKey: "", model: "another-synthetic-model" });
    assert.equal(kept.revision, 2); assert.equal(connectionFromProvider(await readProvider(a))?.apiKey, settings.apiKey);
    await assert.rejects(saveProvider(a, "owner", 2, { ...settings, provider: "ANTHROPIC", apiKey: "" }), /PROVIDER_KEY_REQUIRED/);
    await assert.rejects(saveProvider(a, "owner", 1, settings), /PROVIDER_REVISION_CONFLICT/);
    const disabled = await saveProvider(a, "owner", 2, { provider: "NONE", model: "", baseUrl: "", enabled: false, cloudConsent: false, clearKey: true });
    assert.equal(disabled.hasKey, false); assert.equal(connectionFromProvider(await readProvider(a)), null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("tenant and destination are bound inside the encrypted envelope; copied/tampered keys fail closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-provider-scope-"));
  try {
    const a = config(dir), b = config(dir, "synthetic-b");
    await saveProvider(a, "one", 0, settings); await saveProvider(b, "two", 0, { ...settings, apiKey: "sk-another-synthetic-key" });
    const files = (await readdir(dir)).filter(f => f.endsWith(".json"));
    const docs = await Promise.all(files.map(async f => ({ file: join(dir, f), data: JSON.parse(await readFile(join(dir, f), "utf8")) })));
    const first = docs.find(x => x.data.tenant === a.tenant)!; const second = docs.find(x => x.data.tenant === b.tenant)!;
    first.data.secretEncrypted = second.data.secretEncrypted; await writeFile(first.file, JSON.stringify(first.data));
    await assert.rejects(readProvider(a), /PROVIDER_SECRET_UNAVAILABLE/);
    assert.equal(publicProvider(await readProvider(b)).hasKey, true);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("concurrent updates do not overwrite company secrets or lose revision history", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-provider-race-"));
  try {
    const a = config(dir);
    const results = await Promise.allSettled([saveProvider(a, "one", 0, settings), saveProvider(a, "two", 0, settings)]);
    assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
    assert.equal((await readProvider(a))?.history.length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("provider transports use their own auth and wire format, with no API key in model messages", async () => {
  for (const provider of ["OPENAI", "ANTHROPIC", "OLLAMA"] as const) {
    const connection: ModelConnection = { provider, model: "synthetic", endpoint: provider === "ANTHROPIC" ? "https://api.anthropic.com/v1/messages" : provider === "OPENAI" ? "https://api.openai.com/v1/chat/completions" : "http://127.0.0.1:18444/v1/chat/completions", apiKey: provider === "OLLAMA" ? "" : "synthetic-own-provider-key" };
    let calls = 0;
    const mock: typeof fetch = async (_url, init) => {
      calls++; const body = JSON.parse(String(init?.body)), headers = init?.headers as Record<string, string>;
      assert.equal(body.model, "synthetic");
      assert.equal(provider === "OPENAI" ? body.max_completion_tokens : body.max_tokens, 80);
      assert.doesNotMatch(String(init?.body), /synthetic-own-provider-key|MUST_NOT_LEAK/);
      if (provider === "ANTHROPIC") { assert.equal(headers["x-api-key"], connection.apiKey); assert.ok(body.system); assert.equal(headers.authorization, undefined); }
      else { assert.equal(headers.authorization, provider === "OLLAMA" ? undefined : "Bearer " + connection.apiKey); assert.equal(body.messages[0].role, "system"); }
      return new Response(JSON.stringify(provider === "ANTHROPIC" ? { content: [{ type: "text", text: '{"tool":"MARGIN"}' }] } : { choices: [{ message: { content: '{"tool":"MARGIN"}' } }] }));
    };
    assert.deepEqual(await planQuestion("margin", defaultPreferences, { TAXICRM_AGENT_MODEL_TOKEN: "MUST_NOT_LEAK" }, mock, connection), { tool: "MARGIN", modelUsed: true });
    assert.equal(calls, 1);
    await planQuestion("margin", defaultPreferences, { TAXICRM_AGENT_MODEL_BASE_URL: "https://example.test", TAXICRM_AGENT_MODEL: "default" }, mock, null);
    assert.equal(calls, 1, "explicit company disable never falls back to a deployment model");
  }
});
test("provider failures return to deterministic reports without trying another provider", async () => {
  let calls = 0; const mock: typeof fetch = async () => { calls++; return new Response("bad key", { status: 401 }); };
  const result = await planQuestion("margin", defaultPreferences, {}, mock, { provider: "ANTHROPIC", endpoint: "https://api.anthropic.com/v1/messages", model: "synthetic", apiKey: "fake" });
  assert.deepEqual(result, { tool: "MARGIN", modelUsed: false }); assert.equal(calls, 1);
});

test("audit capacity still permits a final explicit disable and key removal", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-provider-cap-"));
  try {
    const a = config(dir); await saveProvider(a, "owner", 0, settings);
    const file = join(dir, (await readdir(dir)).find(f => f.endsWith(".json"))!);
    const doc = JSON.parse(await readFile(file, "utf8"));
    doc.revision = 100; doc.history = Array.from({ length: 100 }, (_, i) => ({ ...doc.history[0], revision: i + 1 }));
    await writeFile(file, JSON.stringify(doc));
    await assert.rejects(saveProvider(a, "owner", 100, settings), /PROVIDER_AUDIT_CAPACITY_REACHED/);
    await saveProvider(a, "owner", 100, { provider: "NONE", model: "", baseUrl: "", enabled: false, cloudConsent: false, clearKey: true });
    const disabled = await readProvider(a); assert.equal(disabled?.revision, 101); assert.equal(connectionFromProvider(disabled), null); assert.equal(publicProvider(disabled).hasKey, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
