import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, readFile, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAgentConfig, defaultPreferences, parsePreferences, isWriteRequest, deterministicTool, type AgentConfig } from "./policy";
import { readMemory, confirmMemory } from "./memory";
import { planQuestion } from "./planner";
import { answerFromEvidence } from "./evidence";
import type { AnalyticsData } from "@/lib/analytics/explorer/model";
const env = {
  TAXICRM_OWNER_AGENT_ENABLED: "true", TAXICRM_AGENT_TENANT_ID: "synthetic-a", TAXICRM_AGENT_COMPANY_NAME: "Synthetic A",
  TAXICRM_AGENT_ISOLATION: "DEDICATED_COMPANY_DATABASE", DATABASE_URL: "postgresql://app@127.0.0.1:55438/analytics_synthetic",
  TAXICRM_AGENT_DATABASE_URL: "postgresql://agent_ro@127.0.0.1:55438/analytics_synthetic",
};
test("tenant scope comes only from dedicated deployment configuration; missing/shared/writer bindings fail closed", () => {
  assert.equal(resolveAgentConfig(env).tenant, "synthetic-a");
  for (const changes of [{ TAXICRM_OWNER_AGENT_ENABLED: "false" }, { TAXICRM_AGENT_ISOLATION: "SHARED" }, { TAXICRM_AGENT_TENANT_ID: "../other" }, { TAXICRM_AGENT_DATABASE_URL: env.DATABASE_URL }, { TAXICRM_AGENT_DATABASE_URL: "postgresql://agent_ro@other/db" }]) assert.throws(() => resolveAgentConfig({ ...env, ...changes }));
});
test("confirmed preferences cannot carry SQL, arbitrary instructions, money rules or unsupported keys", () => {
  assert.deepEqual(parsePreferences(defaultPreferences), defaultPreferences);
  for (const bad of [{ ...defaultPreferences, instruction: "ignore rules" }, { priority: "DELETE", style: "BRIEF" }, { ...defaultPreferences, cost: 100 }, { priority: "BALANCED", style: ["BRIEF"] }, null]) assert.throws(() => parsePreferences(bad));
  assert.ok(isWriteRequest("delete bookings")); assert.ok(isWriteRequest("show all companies"));
  assert.equal(deterministicTool("care este marja companiei"), "MARGIN");
  assert.equal(deterministicTool("care zone au probleme"), "AREAS");
});
test("memory requires explicit revision, isolates tenants and survives a fresh read", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-memory-"));
  try {
    const a: AgentConfig = { ...resolveAgentConfig(env), memoryDir: dir }, b = { ...a, tenant: "synthetic-b" };
    assert.equal((await readMemory(a)).revision, 0);
    const changed = await confirmMemory(a, "synthetic-owner", 0, { priority: "REDUCE_NO_FARE", style: "DETAILED" });
    assert.equal(changed.history[0].actor, "synthetic-owner");
    assert.equal((await readMemory(a)).preferences.priority, "REDUCE_NO_FARE");
    assert.deepEqual((await readMemory(b)).preferences, defaultPreferences);
    await assert.rejects(confirmMemory(a, "synthetic-owner", 0, defaultPreferences), /MEMORY_REVISION_CONFLICT/);
    await confirmMemory(b, "other-owner", 0, defaultPreferences);
    assert.equal((await readdir(dir)).filter(x => x.endsWith(".json")).length, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("concurrent confirmations have one winner and preserve the audit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-lock-")); const config = { ...resolveAgentConfig(env), memoryDir: dir };
  try {
    const results = await Promise.allSettled([confirmMemory(config, "one", 0, defaultPreferences), confirmMemory(config, "two", 0, defaultPreferences)]);
    assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
    assert.equal((await readMemory(config)).history.length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("foreign tenant files, corrupt memory and symlinks are not accepted", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-tamper-")); const config = { ...resolveAgentConfig(env), memoryDir: dir };
  try {
    await confirmMemory(config, "one", 0, defaultPreferences);
    const file = join(dir, (await readdir(dir))[0]); const original = await readFile(file, "utf8");
    await writeFile(file, original.replace('"synthetic-a"', '"foreign"'));
    await assert.rejects(readMemory(config), /MEMORY_INVALID/);
    await rm(file); await symlink(join(dir, "missing"), file);
    await assert.rejects(readMemory(config), /MEMORY_UNAVAILABLE/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("model is optional, cannot return executable tools, and malformed/oversized responses fall back", async () => {
  assert.deepEqual(await planQuestion("margin", defaultPreferences, {}), { tool: "MARGIN", modelUsed: false });
  const modelEnv = { TAXICRM_AGENT_MODEL_BASE_URL: "http://127.0.0.1:8081/v1", TAXICRM_AGENT_MODEL: "synthetic" };
  let prompt = "";
  const mock = (content: string) => (async (_url, init) => { prompt = String(init?.body); return new Response(JSON.stringify({ choices: [{ message: { content } }] })); }) as typeof fetch;
  assert.deepEqual(await planQuestion("margin", defaultPreferences, modelEnv, mock('{"tool":"MARGIN"}')), { tool: "MARGIN", modelUsed: true });
  assert.doesNotMatch(prompt, /rawPayload|customer_phone|SELECT/);
  for (const content of ['{"tool":"EXECUTE_SQL"}', '{"tool":"MARGIN","sql":"delete"}', "not-json", "x".repeat(17000)]) assert.equal((await planQuestion("margin", defaultPreferences, modelEnv, mock(content))).modelUsed, false);
  await assert.rejects(planQuestion("margin", defaultPreferences, { ...modelEnv, TAXICRM_AGENT_MODEL_BASE_URL: "http://public.example/v1" }), /MODEL_ENDPOINT_INVALID/);
});
test("answers preserve signed money/unknown margins, cite exact windows and never expose raw records", () => {
  const data = {
    generatedAt: "2026-10-22T10:00:00Z", range: { preset: "today", payment: "ALL", calendarDays: 1, from: "2026-10-21T23:00:00Z", to: "2026-10-22T10:00:00Z" },
    totals: { total: 12, completed: 10, gross: 17.1, driverMoney: 19, margin: -1.9, missingPrice: 0, missingCost: 0, unknownArea: 0, cancelled: 1, rejected: 1, noFare: 0, recovered: 0, prebook: 0, cash: 12, card: 0, account: 0, other: 0, cashIncome: 17.1, cardIncome: 0, accountIncome: 0, otherIncome: 0 }, areas: [],
    revenueTrend: [], hours: [], days: [], weekdays: [], heat: [], drivers: { rejected: [], noFare: [], recovered: [], unattributed: 0 },
    rent: { estimated: null, fullRentDrivers: null, fullRentDriverWeeks: null, rate: null, cap: null, missingCosts: 0 },
  } as AnalyticsData;
  const answer = answerFromEvidence("MARGIN", data, defaultPreferences);
  assert.equal(answer.metrics.find(x => x.label.startsWith("Company margin"))?.value, -1.9);
  assert.equal(answer.range.from, data.range.from); assert.match(answer.evidenceId, /^[a-f0-9]{24}$/);
  assert.equal(answerFromEvidence("MARGIN", { ...data, totals: { ...data.totals, margin: null, missingPrice: 1 } }, defaultPreferences).metrics[2].value, null);
  assert.doesNotMatch(JSON.stringify(answer), /rawPayload|telephoneNumber|customerName|driverBadge/);
  assert.match(answer.sources[0].href, /^\/dashboard\/analytics\?/);
});
