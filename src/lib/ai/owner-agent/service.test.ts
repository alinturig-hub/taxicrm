import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serviceAccess, executeServiceTask, readServiceTask } from "./service";
import type { AgentConfig } from "./policy";
const config = (memoryDir: string, tenant = "synthetic-a"): AgentConfig => ({ memoryDir, tenant, name: "Synthetic", databaseUrl: "unused", role: "unused_ro", database: "unused" });
test("service credentials are separate, explicitly enabled, bounded and never accepted as customer identity", () => {
  const env = { TAXICRM_AGENT_SERVICE_ENABLED: "true", TAXICRM_AGENT_SERVICE_TOKEN: "synthetic-service-token-not-real-0000000000" };
  const request = (token: string) => new Request("https://example.test/api/internal/owner-agent/tasks", { headers: { authorization: "Bearer " + token } });
  assert.throws(() => serviceAccess(request(env.TAXICRM_AGENT_SERVICE_TOKEN), {}), /AGENT_SERVICE_NOT_ENABLED/);
  assert.throws(() => serviceAccess(request("wrong"), env), /AGENT_SERVICE_UNAUTHORIZED/);
  assert.deepEqual(serviceAccess(request(env.TAXICRM_AGENT_SERVICE_TOKEN), env).operations, ["ANALYSE"]);
});
test("task retries return the original result without rerunning a model or source query", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-task-")); let calls = 0;
  try {
    const cfg = config(dir), requestId = randomUUID(), request = { operation: "ANALYSE", question: "synthetic-private-business-question", preset: "today" };
    const first = await executeServiceTask(cfg, requestId, request, async () => { calls++; return { bookings: 12 }; });
    const second = await executeServiceTask(cfg, requestId, { preset: "today", question: request.question, operation: "ANALYSE" }, async () => { calls++; return {}; });
    assert.equal(calls, 1); assert.equal(first.state, "DONE"); assert.deepEqual(second, first);
    await assert.rejects(executeServiceTask(cfg, requestId, { ...request, question: "different" }, async () => ({})), /TASK_IDEMPOTENCY_CONFLICT/);
    const folder = join(dir, (await readdir(dir))[0]); const files = await readdir(folder);
    assert.equal(files.length, 1);
    assert.doesNotMatch(await readFile(join(folder, files[0]), "utf8"), /synthetic-private-business-question|Bearer/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("parallel submissions cannot execute twice; separate tenants cannot read each other's task", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-task-race-")); let calls = 0;
  try {
    const cfg = config(dir), requestId = randomUUID(), request = { question: "margin" };
    const run = () => executeServiceTask(cfg, requestId, request, async () => { calls++; await new Promise(resolve => setTimeout(resolve, 30)); return { margin: -1.9 }; });
    await Promise.allSettled([run(), run()]);
    assert.equal(calls, 1); assert.equal((await readServiceTask(cfg, requestId))?.state, "DONE");
    assert.equal(await readServiceTask(config(dir, "synthetic-b"), requestId), null);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("failures are audited without raw errors or implicit retry, and task paths cannot escape", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-task-fail-")); let calls = 0;
  try {
    const cfg = config(dir), requestId = randomUUID();
    const failed = await executeServiceTask(cfg, requestId, { question: "demand" }, async () => { calls++; throw Error("private-token-DO-NOT-STORE"); });
    assert.equal(failed.state, "FAILED"); assert.equal(failed.error, "AGENT_SERVICE_ANALYSIS_FAILED");
    assert.doesNotMatch(JSON.stringify(failed), /private-token/);
    await executeServiceTask(cfg, requestId, { question: "demand" }, async () => { calls++; return {}; });
    assert.equal(calls, 1);
    await assert.rejects(readServiceTask(cfg, "../../other"), /TASK_UUID_REQUIRED/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
