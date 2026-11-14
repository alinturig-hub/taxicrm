import { constants } from "node:fs";
import { mkdir, lstat, open, rename, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join, isAbsolute } from "node:path";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import { AgentError, type AgentConfig } from "./policy";
import { parseProviderInput, endpointFor, type ProviderInput, type ProviderId, type ModelConnection } from "./providers";
type Audit = { revision: number; actor: string; confirmedAt: string; provider: ProviderId; model: string; enabled: boolean; keyChanged: boolean };
type ProviderRecord = Omit<ProviderInput, "apiKey" | "clearKey"> & { version: 1; tenant: string; revision: number; secretEncrypted: string; history: Audit[] };
function filename(config: AgentConfig) {
  if (!config.memoryDir || !isAbsolute(config.memoryDir)) throw new AgentError("DURABLE_MEMORY_NOT_CONFIGURED", 503);
  return join(config.memoryDir, createHash("sha256").update(config.tenant).digest("hex") + "-model.json");
}
function keyFromRecord(record: ProviderRecord) {
  try {
    const secret = JSON.parse(decryptSecret(record.secretEncrypted));
    if (secret.tenant !== record.tenant || secret.provider !== record.provider || secret.model !== record.model || secret.baseUrl !== record.baseUrl || secret.enabled !== record.enabled || secret.cloudConsent !== record.cloudConsent || typeof secret.apiKey !== "string") throw Error();
    if (record.enabled && ["OPENAI", "ANTHROPIC"].includes(record.provider) && !secret.apiKey) throw Error();
    return secret.apiKey as string;
  } catch { throw new AgentError("PROVIDER_SECRET_UNAVAILABLE", 503); }
}
export function providerStorageReady(config: AgentConfig) {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY || "";
  const bytes = /^[a-f0-9]{64}$/i.test(key) ? Buffer.from(key, "hex") : Buffer.from(key, "base64");
  return !!config.memoryDir && isAbsolute(config.memoryDir) && bytes.length === 32;
}
export async function readProvider(config: AgentConfig): Promise<ProviderRecord | null> {
  if (!config.memoryDir) return null;
  let file;
  try {
    const root = await lstat(config.memoryDir);
    if (!root.isDirectory() || root.isSymbolicLink()) throw new AgentError("PROVIDER_STORAGE_INVALID", 503);
    file = await open(filename(config), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await file.stat(); if (!stat.isFile() || stat.size > 100000) throw new AgentError("PROVIDER_STORAGE_INVALID", 503);
    const record = JSON.parse(await file.readFile("utf8")) as ProviderRecord;
    if (record.version !== 1 || record.tenant !== config.tenant || !Number.isInteger(record.revision) || record.revision < 1 || record.revision > 101 || !Array.isArray(record.history) || record.history.length !== record.revision || typeof record.secretEncrypted !== "string") throw new AgentError("PROVIDER_STORAGE_INVALID", 503);
    // Allowlist changes are enforced on every use, not just on save.
    parseProviderInput({ provider: record.provider, model: record.model, baseUrl: record.baseUrl, enabled: record.enabled, cloudConsent: record.cloudConsent, clearKey: false });
    for (let i = 0; i < record.history.length; i++) {
      const entry = record.history[i];
      if (entry.revision !== i + 1 || typeof entry.actor !== "string" || entry.actor.length > 100 || !Number.isFinite(Date.parse(entry.confirmedAt))) throw new AgentError("PROVIDER_STORAGE_INVALID", 503);
    }
    keyFromRecord(record);
    return record;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e instanceof AgentError && e.status === 503 ? e : new AgentError("PROVIDER_STORAGE_INVALID", 503);
  } finally { await file?.close(); }
}
export function publicProvider(record: ProviderRecord | null) {
  return record ? { revision: record.revision, provider: record.provider, model: record.model, baseUrl: record.baseUrl, enabled: record.enabled, cloudConsent: record.cloudConsent, hasKey: !!keyFromRecord(record) }
    : { revision: 0, provider: "NONE" as const, model: "", baseUrl: "", enabled: false, cloudConsent: false, hasKey: false };
}
export async function saveProvider(config: AgentConfig, actor: string, revision: number, raw: unknown) {
  if (!providerStorageReady(config)) throw new AgentError("PROVIDER_STORAGE_KEY_REQUIRED", 503);
  const input = parseProviderInput(raw), path = filename(config);
  if (!actor || actor.length > 100 || !Number.isInteger(revision) || revision < 0) throw new AgentError("INVALID_PROVIDER_SETTINGS");
  await mkdir(config.memoryDir!, { recursive: true, mode: 0o700 });
  if ((await lstat(config.memoryDir!)).isSymbolicLink()) throw new AgentError("PROVIDER_STORAGE_INVALID", 503);
  let lock;
  try { lock = await open(path + ".lock", "wx", 0o600); } catch { throw new AgentError("PROVIDER_SETTINGS_BUSY", 409); }
  const temp = path + "." + randomUUID() + ".tmp";
  try {
    const old = await readProvider(config);
    if ((old?.revision || 0) !== revision) throw new AgentError("PROVIDER_REVISION_CONFLICT", 409);
    if (revision >= 101 || (revision >= 100 && input.provider !== "NONE")) throw new AgentError("PROVIDER_AUDIT_CAPACITY_REACHED", 409);
    let apiKey = input.apiKey || "";
    if (!apiKey && !input.clearKey && old && old.provider === input.provider && old.baseUrl === input.baseUrl) apiKey = keyFromRecord(old);
    if (input.provider === "NONE" || input.clearKey) apiKey = "";
    if (input.enabled && ["OPENAI", "ANTHROPIC"].includes(input.provider) && !apiKey) throw new AgentError("PROVIDER_KEY_REQUIRED");
    const { apiKey: _unused, clearKey, ...settings } = input; void _unused;
    const encrypted = encryptSecret(JSON.stringify({ tenant: config.tenant, ...settings, apiKey }));
    const record: ProviderRecord = { ...settings, version: 1, tenant: config.tenant, revision: revision + 1, secretEncrypted: encrypted,
      history: [...(old?.history || []), { revision: revision + 1, actor, confirmedAt: new Date().toISOString(), provider: input.provider, model: input.model, enabled: input.enabled, keyChanged: !!input.apiKey || clearKey || old?.provider !== input.provider || old?.baseUrl !== input.baseUrl }] };
    const file = await open(temp, "wx", 0o600); try { await file.writeFile(JSON.stringify(record)); await file.sync(); } finally { await file.close(); }
    await rename(temp, path);
    const directory = await open(config.memoryDir!, constants.O_RDONLY); try { await directory.sync(); } finally { await directory.close(); }
    return publicProvider(record);
  } finally { await unlink(temp).catch(() => {}); await lock.close(); await unlink(path + ".lock"); }
}
export function connectionFromProvider(record: ProviderRecord | null): ModelConnection | null | undefined {
  if (!record) return undefined; // legacy deployment-level binding remains explicit
  if (!record.enabled || record.provider === "NONE") return null;
  return { provider: record.provider, model: record.model, endpoint: endpointFor(record.provider, record.baseUrl), apiKey: keyFromRecord(record) };
}
