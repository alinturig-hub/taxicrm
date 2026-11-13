import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, lstat, open, readdir, rename, unlink } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { AgentError, type AgentConfig } from "./policy";
export function serviceAccess(request: Request, env: Readonly<Record<string, string | undefined>> = process.env) {
  const expected = env.TAXICRM_AGENT_SERVICE_TOKEN || "";
  if (env.TAXICRM_AGENT_SERVICE_ENABLED !== "true" || expected.length < 32) throw new AgentError("AGENT_SERVICE_NOT_ENABLED", 503);
  const supplied = request.headers.get("authorization") || "";
  const token = supplied.startsWith("Bearer ") ? supplied.slice(7) : "";
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (!token || token.length > 4096 || !timingSafeEqual(digest(expected), digest(token))) throw new AgentError("AGENT_SERVICE_UNAUTHORIZED", 401);
  return { principal: "LYTH_SERVICE", operations: ["ANALYSE"] as const };
}
export type ServiceTask = { version: 1; tenant: string; requestId: string; requestDigest: string; principal: "LYTH_SERVICE"; state: "RUNNING" | "DONE" | "FAILED"; startedAt: string; finishedAt?: string; result?: unknown; error?: string };
function paths(config: AgentConfig, requestId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new AgentError("TASK_UUID_REQUIRED");
  if (!config.memoryDir || !isAbsolute(config.memoryDir)) throw new AgentError("SERVICE_AUDIT_STORAGE_REQUIRED", 503);
  const directory = join(config.memoryDir, createHash("sha256").update(config.tenant).digest("hex") + "-tasks");
  return { directory, file: join(directory, requestId.toLowerCase() + ".json") };
}
export async function readServiceTask(config: AgentConfig, requestId: string): Promise<ServiceTask | null> {
  const { directory, file: path } = paths(config, requestId); let file;
  try {
    const root = await lstat(config.memoryDir!), dir = await lstat(directory);
    if (root.isSymbolicLink() || !root.isDirectory() || dir.isSymbolicLink() || !dir.isDirectory()) throw Error();
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); const stat = await file.stat();
    if (!stat.isFile() || stat.size > 256000) throw Error();
    const task = JSON.parse(await file.readFile("utf8")) as ServiceTask;
    if (task.version !== 1 || task.tenant !== config.tenant || task.requestId !== requestId.toLowerCase() || !["RUNNING", "DONE", "FAILED"].includes(task.state) || !/^[a-f0-9]{64}$/.test(task.requestDigest) || task.principal !== "LYTH_SERVICE") throw Error();
    return task;
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw new AgentError("SERVICE_AUDIT_UNAVAILABLE", 503); }
  finally { await file?.close(); }
}
async function writeTask(directory: string, path: string, task: ServiceTask) {
  const text = JSON.stringify(task); if (Buffer.byteLength(text) > 256000) throw new AgentError("SERVICE_RESULT_TOO_LARGE", 503);
  const temporary = path + "." + randomUUID() + ".tmp"; let file;
  try { file = await open(temporary, "wx", 0o600); await file.writeFile(text); await file.sync(); await file.close(); file = undefined; await rename(temporary, path); const dir = await open(directory, constants.O_RDONLY); try { await dir.sync(); } finally { await dir.close(); } }
  finally { await file?.close(); await unlink(temporary).catch(() => {}); }
}
export async function executeServiceTask(config: AgentConfig, requestId: string, request: Record<string, string>, operation: () => Promise<unknown>) {
  requestId = requestId.toLowerCase();
  const { directory, file: path } = paths(config, requestId);
  const requestDigest = createHash("sha256").update(JSON.stringify(Object.entries(request).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
  const existing = await readServiceTask(config, requestId);
  if (existing) { if (existing.requestDigest !== requestDigest) throw new AgentError("TASK_IDEMPOTENCY_CONFLICT", 409); return existing; }
  await mkdir(config.memoryDir!, { recursive: true, mode: 0o700 });
  const root = await lstat(config.memoryDir!);
  if (root.isSymbolicLink() || !root.isDirectory()) throw new AgentError("SERVICE_AUDIT_UNAVAILABLE", 503);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const dir = await lstat(directory);
  if (dir.isSymbolicLink() || !dir.isDirectory()) throw new AgentError("SERVICE_AUDIT_UNAVAILABLE", 503);
  let lock; try { lock = await open(path + ".lock", "wx", 0o600); } catch { throw new AgentError("TASK_ALREADY_RUNNING", 409); }
  try {
    const raced = await readServiceTask(config, requestId);
    if (raced) { if (raced.requestDigest !== requestDigest) throw new AgentError("TASK_IDEMPOTENCY_CONFLICT", 409); return raced; }
    if ((await readdir(directory)).filter(f => f.endsWith(".json")).length >= 500) throw new AgentError("SERVICE_AUDIT_CAPACITY_REACHED", 409);
    let task: ServiceTask = { version: 1, tenant: config.tenant, requestId, requestDigest, principal: "LYTH_SERVICE", state: "RUNNING", startedAt: new Date().toISOString() };
    await writeTask(directory, path, task);
    try { const result = await operation(); task = { ...task, state: "DONE", finishedAt: new Date().toISOString(), result }; }
    catch (e) { task = { ...task, state: "FAILED", finishedAt: new Date().toISOString(), error: e instanceof AgentError ? e.code : "AGENT_SERVICE_ANALYSIS_FAILED" }; }
    await writeTask(directory, path, task);
    return task;
  } finally { await lock.close(); await unlink(path + ".lock"); }
}
