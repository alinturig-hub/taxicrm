import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappSettings, whatsappCredentials, WhatsAppError } from "./settings";
import { listTemplates, templatePreview } from "./templates";
import { reserveWhatsAppList } from "./limit";
const token = "synthetic-meta-token-not-a-real-secret";
const env = { META_WHATSAPP_ENABLED: "true", META_WHATSAPP_APP_ID: "123456789", META_WHATSAPP_WABA_ID: "987654321", META_WHATSAPP_GRAPH_VERSION: "v999.0", META_WHATSAPP_ACCESS_TOKEN: token };
const draft = { name: "booking_update", language: "en_GB", category: "UTILITY", text: "Hello {{1}}, reference {{2}}. Thank you.", samples: ["Synthetic customer", "SYNTHETIC-123"] };
const code = (value: string) => (error: unknown) => error instanceof WhatsAppError && error.code === value;
test("configuration starts disabled, missing fields stay explicit, secrets never enter public settings", () => {
  const empty = whatsappSettings({}); assert.equal(empty.enabled, false); assert.equal(empty.ready, false); assert.equal(empty.issues.length, 4);
  const ready = whatsappSettings(env); assert.equal(ready.ready, true); assert.equal(ready.messagingEnabled, false); assert.equal(ready.templateSubmissionEnabled, false); assert.ok(!JSON.stringify(ready).includes(token));
  const bad = whatsappSettings({ ...env, META_WHATSAPP_WABA_ID: "https://bad.example/", META_WHATSAPP_ACCESS_TOKEN: "bad\nsecret" }); assert.equal(bad.wabaId, ""); assert.equal(bad.hasToken, false); assert.ok(!JSON.stringify(bad).includes("bad.example"));
});
test("invalid and disabled settings fail before any external call", async () => {
  let calls = 0; const fetcher = (async () => { calls++; throw Error("unexpected call"); }) as typeof fetch;
  await assert.rejects(listTemplates({ ...env, META_WHATSAPP_ENABLED: "false" }, fetcher), code("WHATSAPP_DISABLED"));
  await assert.rejects(listTemplates({ ...env, META_WHATSAPP_GRAPH_VERSION: "../../" }, fetcher), code("WHATSAPP_SETUP_REQUIRED"));
  assert.throws(() => whatsappCredentials({ ...env, META_WHATSAPP_ACCESS_TOKEN: undefined }), code("WHATSAPP_SETUP_REQUIRED")); assert.equal(calls, 0);
});
test("listing uses only the fixed Meta origin, bearer header, bounded GET and redacted fields", async () => {
  const result = await listTemplates(env, (async (url, options) => {
    const request = new URL(String(url)); assert.equal(request.origin, "https://graph.facebook.com"); assert.equal(request.pathname, "/v999.0/987654321/message_templates"); assert.equal(request.searchParams.get("limit"), "25"); assert.ok(!String(url).includes(token)); assert.equal(options?.method, "GET"); assert.equal(options?.redirect, "error"); assert.equal(options?.cache, "no-store"); assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer " + token);
    return Response.json({ data: [{ id: "1", name: "synthetic", status: "APPROVED", category: "UTILITY", language: "en_GB", unexpectedSecret: token, components: [{ type: "BODY", text: "Synthetic body" }] }], paging: { next: "https://evil.example/?access_token=" + token } });
  }) as typeof fetch);
  assert.equal(result.templates[0].body, "Synthetic body"); assert.equal(result.hasMore, true); assert.ok(!JSON.stringify(result).includes(token)); assert.ok(!JSON.stringify(result).includes("evil.example"));
});
test("Meta errors and transport failures never echo raw responses or token", async () => {
  for (const [status, expected] of [[401, "META_ACCESS_DENIED"], [403, "META_ACCESS_DENIED"], [429, "META_RATE_LIMITED"], [500, "META_REQUEST_FAILED"]] as const) {
    await assert.rejects(listTemplates(env, (async () => new Response(token, { status })) as typeof fetch), code(expected));
  }
  await assert.rejects(listTemplates(env, (async () => { throw Error(token); }) as typeof fetch), error => code("META_CONNECTION_FAILED")(error) && !String(error).includes(token));
});
test("large/malformed responses and excessive result counts fail closed", async () => {
  for (const payload of ["not json", JSON.stringify({ data: {} }), JSON.stringify({ data: Array.from({ length: 26 }, () => ({})) })]) await assert.rejects(listTemplates(env, (async () => new Response(payload)) as typeof fetch), code("META_INVALID_RESPONSE"));
  await assert.rejects(listTemplates(env, (async () => new Response("x".repeat(262145))) as typeof fetch), code("META_RESPONSE_TOO_LARGE"));
});
test("preview creates a body-only payload and synthetic rendered text without submitting", () => {
  const before = structuredClone(draft); const result = templatePreview(draft);
  assert.equal(result.renderedText, "Hello Synthetic customer, reference SYNTHETIC-123. Thank you."); assert.equal(result.submitted, false); assert.deepEqual(result.payload.components[0].example, { body_text: [draft.samples] }); assert.deepEqual(draft, before);
  const repeated = templatePreview({ ...draft, text: "Hello {{1}}. Repeat {{1}}.", samples: ["Example"] }); assert.equal(repeated.renderedText, "Hello Example. Repeat Example.");
  assert.equal(templatePreview({ ...draft, text: "Plain synthetic text.", samples: [] }).payload.components[0].example, undefined);
});
test("preview refuses unsupported actions, malformed variables and misleading samples", () => {
  for (const [patch, expected] of [
    [{ name: "Invalid Name" }, "INVALID_TEMPLATE_NAME"], [{ language: "xx" }, "UNSUPPORTED_LANGUAGE"], [{ category: "AUTHENTICATION" }, "UNSUPPORTED_CATEGORY"], [{ text: "" }, "INVALID_TEMPLATE_TEXT"], [{ text: "x".repeat(1025) }, "INVALID_TEMPLATE_TEXT"], [{ text: "Hello {{name}}." }, "INVALID_VARIABLES"], [{ text: "Hello {{2}}.", samples: ["example"] }, "VARIABLES_MUST_BE_SEQUENTIAL"], [{ samples: [] }, "VARIABLE_SAMPLES_REQUIRED"], [{ samples: ["x", ""] }, "VARIABLE_SAMPLES_REQUIRED"], [{ accessToken: token }, "INVALID_DRAFT"],
  ] as const) assert.throws(() => templatePreview({ ...draft, ...patch }), code(expected));
});

test("template listing limiter bounds concurrency and same-user retries", () => {
  const releases: Array<() => void> = [];
  try {
    releases.push(reserveWhatsAppList("synthetic-user-a", 10_000));
    releases.push(reserveWhatsAppList("synthetic-user-b", 10_000));
    assert.throws(() => reserveWhatsAppList("synthetic-user-c", 10_000), code("WHATSAPP_BUSY_RETRY"));
    releases.pop()!();
    assert.throws(() => reserveWhatsAppList("synthetic-user-a", 20_000), code("WHATSAPP_BUSY_RETRY"));
    const release = reserveWhatsAppList("synthetic-user-c", 10_000);
    release();
  } finally {
    releases.forEach(release => release());
  }
});
