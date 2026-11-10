import { constants } from "node:fs";
import { mkdir, open, rename, unlink, lstat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { AgentError, defaultPreferences, parsePreferences, type AgentConfig, type Preferences } from "./policy";
export type Memory = { version: 1; tenant: string; revision: number; preferences: Preferences; history: { revision: number; actor: string; confirmedAt: string; preferences: Preferences }[] };
const empty = (tenant: string): Memory => ({ version: 1, tenant, revision: 0, preferences: { ...defaultPreferences }, history: [] });
function filename(config: AgentConfig) {
  if (!config.memoryDir || !isAbsolute(config.memoryDir)) throw new AgentError("DURABLE_MEMORY_NOT_CONFIGURED", 503);
  return join(config.memoryDir, createHash("sha256").update(config.tenant).digest("hex") + ".json");
}
export async function readMemory(config: AgentConfig): Promise<Memory> {
  if (!config.memoryDir) return empty(config.tenant);
  const path = filename(config);
  let file;
  try {
    const root = await lstat(config.memoryDir!);
    if (!root.isDirectory() || root.isSymbolicLink()) throw new AgentError("MEMORY_DIRECTORY_INVALID", 503);
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 100000) throw new AgentError("MEMORY_INVALID", 503);
    const doc = JSON.parse(await file.readFile("utf8")) as Memory;
    if (doc.version !== 1 || doc.tenant !== config.tenant || !Number.isInteger(doc.revision) || doc.revision < 0 || doc.revision > 100 || !Array.isArray(doc.history) || doc.history.length !== doc.revision) throw new AgentError("MEMORY_INVALID", 503);
    const preferences = parsePreferences(doc.preferences);
    for (let i = 0; i < doc.history.length; i++) {
      const entry = doc.history[i];
      if (entry.revision !== i + 1 || typeof entry.actor !== "string" || entry.actor.length > 100 || !Number.isFinite(Date.parse(entry.confirmedAt))) throw new AgentError("MEMORY_INVALID", 503);
      parsePreferences(entry.preferences);
    }
    if (doc.history.length && JSON.stringify(doc.history[doc.history.length - 1].preferences) !== JSON.stringify(preferences)) throw new AgentError("MEMORY_INVALID", 503);
    return { ...doc, preferences };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty(config.tenant);
    throw e instanceof AgentError && e.status === 503 ? e : new AgentError("MEMORY_UNAVAILABLE", 503);
  } finally { await file?.close(); }
}
export async function confirmMemory(config: AgentConfig, actor: string, revision: number, preferences: unknown): Promise<Memory> {
  const next = parsePreferences(preferences), path = filename(config);
  if (!Number.isInteger(revision) || revision < 0 || !actor || actor.length > 100) throw new AgentError("INVALID_CONFIRMATION");
  await mkdir(config.memoryDir!, { recursive: true, mode: 0o700 });
  if ((await lstat(config.memoryDir!)).isSymbolicLink()) throw new AgentError("MEMORY_DIRECTORY_INVALID", 503);
  let lock;
  try { lock = await open(path + ".lock", "wx", 0o600); }
  catch { throw new AgentError("MEMORY_BUSY_RETRY", 409); }
  const temporary = path + "." + randomUUID() + ".tmp";
  try {
    const previous = await readMemory(config);
    if (previous.revision !== revision) throw new AgentError("MEMORY_REVISION_CONFLICT", 409);
    if (previous.revision >= 100) throw new AgentError("MEMORY_AUDIT_CAPACITY_REACHED", 409);
    const entry = { revision: revision + 1, actor, confirmedAt: new Date().toISOString(), preferences: next };
    const doc: Memory = { version: 1, tenant: config.tenant, revision: entry.revision, preferences: next, history: [...previous.history, entry] };
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(JSON.stringify(doc)); await file.sync(); } finally { await file.close(); }
    await rename(temporary, path);
    const directory = await open(config.memoryDir!, constants.O_RDONLY);
    try { await directory.sync(); } finally { await directory.close(); }
    return doc;
  } finally { await unlink(temporary).catch(() => { }); await lock.close(); await unlink(path + ".lock"); }
}
