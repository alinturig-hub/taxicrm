import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { publicSettings, saveSettings, removeSettings, currentKey } from "./store";
import { checkSendgridKey } from "./check";
import { sendTest } from "./send-test";
import { randomUUID } from "node:crypto";

const key = "SG.synthetic_key_example.synthetic_secret_value";
test("confirmed tests send once and retain ambiguous results without retry", async () => {
  const root = await mkdtemp(join(tmpdir(), "sendgrid-test-"));
  const oldDir = process.env.SENDGRID_CONFIG_DIR, oldKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.SENDGRID_CONFIG_DIR = join(root, "private"); process.env.INTEGRATION_ENCRYPTION_KEY = "ab".repeat(32);
  try {
    await saveSettings({ senderEmail: "owner@example.test", senderName: "Synthetic", apiKey: key, expectedRevision: 0 }, "admin");
    let calls = 0;
    const transport: typeof fetch = async (url, init) => { calls++; assert.equal(url, "https://api.sendgrid.com/v3/mail/send"); assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error"); assert.equal(JSON.parse(String(init?.body)).personalizations[0].to[0].email, "test@example.test"); return new Response(null, { status: 202 }); };
    const input = { confirm: true, expectedRevision: 1, recipient: "test@example.test", requestId: randomUUID() };
    await assert.rejects(sendTest({ ...input, confirm: false }, transport), /INVALID_REQUEST/);
    assert.deepEqual(await sendTest(input, transport), { state: "ACCEPTED", replay: false });
    assert.deepEqual(await sendTest(input, transport), { state: "ACCEPTED", replay: true });
    await assert.rejects(sendTest({ ...input, recipient: "another@example.test" }, transport), /TEST_REQUEST_CONFLICT/);
    assert.equal(calls, 1);
    assert.doesNotMatch(await readFile(join(root, "private", `test-${input.requestId}.json`), "utf8"), /test@example|synthetic_secret/);
    const unknown = { ...input, requestId: randomUUID() };
    assert.equal((await sendTest(unknown, async () => { calls++; throw new Error("timeout"); })).state, "UNKNOWN");
    assert.deepEqual(await sendTest(unknown, transport), { state: "UNKNOWN", replay: true });
    assert.equal(calls, 2);
  } finally { if (oldDir === undefined) delete process.env.SENDGRID_CONFIG_DIR; else process.env.SENDGRID_CONFIG_DIR = oldDir; if (oldKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = oldKey; await rm(root, { recursive: true, force: true }); }
});
test("encrypted settings support safe key rotation, removal and revision conflicts", async () => {
  const root = await mkdtemp(join(tmpdir(), "sendgrid-synthetic-"));
  const oldDir = process.env.SENDGRID_CONFIG_DIR, oldKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.SENDGRID_CONFIG_DIR = join(root, "private"); process.env.INTEGRATION_ENCRYPTION_KEY = "ab".repeat(32);
  try {
    assert.deepEqual(await publicSettings(), { storageReady: true, configured: false, revision: 0 });
    const saved = await saveSettings({ senderEmail: "owner@example.test", senderName: "Synthetic", apiKey: key, expectedRevision: 0 }, "synthetic-admin");
    assert.equal(saved.configured, true); assert.equal(saved.revision, 1);
    assert.doesNotMatch(JSON.stringify(saved), /synthetic_secret_value/);
    assert.doesNotMatch(await readFile(join(root, "private", "sendgrid.json"), "utf8"), /synthetic_secret_value|owner@example.test/);
    assert.equal(await currentKey(1), key);
    await assert.rejects(saveSettings({ senderEmail: "owner@example.test", senderName: "Synthetic", apiKey: "", expectedRevision: 0 }, "admin"), /REVISION_CONFLICT/);
    const updated = await saveSettings({ senderEmail: "new@example.test", senderName: "Synthetic", apiKey: "", expectedRevision: 1 }, "admin");
    assert.equal(updated.revision, 2); assert.equal(await currentKey(2), key);
    const removed = await removeSettings(2, "admin"); assert.equal(removed.configured, false); assert.equal(removed.revision, 3);
    await assert.rejects(currentKey(2), /REVISION_CONFLICT/);
    await assert.rejects(saveSettings({ senderEmail: "owner@example.test", senderName: "Synthetic", apiKey: "", expectedRevision: 3 }, "admin"), /KEY_REQUIRED/);
    await assert.rejects(saveSettings({ senderEmail: "owner@example.test", senderName: "Synthetic", apiKey: key, expectedRevision: 0 }, "admin"), /REVISION_CONFLICT/);
  } finally { if (oldDir === undefined) delete process.env.SENDGRID_CONFIG_DIR; else process.env.SENDGRID_CONFIG_DIR = oldDir; if (oldKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = oldKey; await rm(root, { recursive: true, force: true }); }
});
test("storage rejects invalid inputs, secret-bearing extra fields and symlink directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "sendgrid-synthetic-")); const oldDir = process.env.SENDGRID_CONFIG_DIR, oldKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = "ab".repeat(32); process.env.SENDGRID_CONFIG_DIR = join(root, "private");
  try {
    for (const data of [{ senderEmail: "not-email", senderName: "Synthetic", apiKey: key, expectedRevision: 0 }, { senderEmail: "x@example.test", senderName: "Bad\nName", apiKey: key, expectedRevision: 0 }, { senderEmail: "x@example.test", senderName: "Synthetic", apiKey: key, expectedRevision: 0, extra: true }]) await assert.rejects(saveSettings(data, "admin"), /INVALID_SETTINGS/);
    await symlink(root, join(root, "private"));
    await assert.rejects(saveSettings({ senderEmail: "x@example.test", senderName: "Synthetic", apiKey: key, expectedRevision: 0 }, "admin"), /STORAGE_INVALID/);
  } finally { if (oldDir === undefined) delete process.env.SENDGRID_CONFIG_DIR; else process.env.SENDGRID_CONFIG_DIR = oldDir; if (oldKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = oldKey; await rm(root, { recursive: true, force: true }); }
});
test("connection test checks only fixed SendGrid scopes, no email is sent", async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, init) => { calls++; assert.equal(url, "https://api.sendgrid.com/v3/scopes"); assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "error"); assert.equal((init?.headers as Record<string,string>).authorization, `Bearer ${key}`); return new Response(JSON.stringify({ scopes: ["mail.send"] })); };
  assert.deepEqual(await checkSendgridKey(key, transport), { state: "VERIFIED", canSend: true }); assert.equal(calls, 1);
  assert.deepEqual(await checkSendgridKey(key, async () => new Response(JSON.stringify({ scopes: [] }))), { state: "VERIFIED", canSend: false });
  assert.deepEqual(await checkSendgridKey(key, async () => new Response("", { status: 403 })), { state: "NOT_VERIFIED" });
  assert.deepEqual(await checkSendgridKey(key, async () => new Response("invalid")), { state: "UNAVAILABLE" });
  assert.deepEqual(await checkSendgridKey(key, async () => new Response("x".repeat(66000))), { state: "UNAVAILABLE" });
});

test("parallel saves cannot both replace the same revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "sendgrid-synthetic-")); const oldDir = process.env.SENDGRID_CONFIG_DIR, oldKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.SENDGRID_CONFIG_DIR = join(root, "private"); process.env.INTEGRATION_ENCRYPTION_KEY = "ab".repeat(32);
  try {
    const input = { senderEmail: "owner@example.test", senderName: "Synthetic", apiKey: key, expectedRevision: 0 };
    const outcomes = await Promise.allSettled([saveSettings(input, "one"), saveSettings(input, "two")]);
    assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
    const final = await publicSettings(); assert.equal(final.revision, 1); assert.equal(final.configured, true);
  } finally { if (oldDir === undefined) delete process.env.SENDGRID_CONFIG_DIR; else process.env.SENDGRID_CONFIG_DIR = oldDir; if (oldKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = oldKey; await rm(root, { recursive: true, force: true }); }
});
