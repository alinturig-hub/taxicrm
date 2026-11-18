import { constants } from "node:fs";
import { access, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { isAbsolute, join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";

type SendgridConfig = { senderEmail: string; senderName: string; apiKey: string };
type Envelope = { version: 1; revision: number; encrypted: string; updatedAt: string; updatedBy: string };
export class SendgridSettingsError extends Error { constructor(public code: string) { super(code); } }
const error = (code: string): never => { throw new SendgridSettingsError(code); };
function directory() {
  const dir = process.env.SENDGRID_CONFIG_DIR;
  if (!dir || !isAbsolute(dir) || dir === "/") return error("STORAGE_NOT_CONFIGURED");
  return dir;
}
export async function storageReady() {
  try {
    const dir = directory(), parent = dirname(dir);
    const key = process.env.INTEGRATION_ENCRYPTION_KEY || "";
    const valid = /^[a-f0-9]{64}$/i.test(key) ? Buffer.from(key, "hex").length === 32 : Buffer.from(key, "base64").length === 32;
    const stat = await lstat(parent); if (!valid || !stat.isDirectory() || stat.isSymbolicLink()) return false;
    await access(parent, constants.W_OK); return true;
  } catch { return false; }
}
function validateEmail(value: unknown) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}
function validKey(key: unknown) { return typeof key === "string" && /^SG\.[A-Za-z0-9_-]{10,100}\.[A-Za-z0-9_-]{10,150}$/.test(key); }
function parseSettings(value: unknown): SendgridConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return error("STORAGE_INVALID");
  const x = value as Record<string, unknown>;
  if (Object.keys(x).sort().join(",") !== "apiKey,senderEmail,senderName" || !validateEmail(x.senderEmail) || typeof x.senderName !== "string" || !x.senderName.trim() || x.senderName.length > 100 || /[\x00-\x1f\x7f]/.test(x.senderName) || !validKey(x.apiKey)) return error("STORAGE_INVALID");
  return { senderEmail: x.senderEmail as string, senderName: x.senderName.trim(), apiKey: x.apiKey as string };
}
async function read(): Promise<{ envelope: Envelope; config: SendgridConfig | null } | null> {
  const dir = directory(); let file;
  try {
    const root = await lstat(dir); if (!root.isDirectory() || root.isSymbolicLink()) return error("STORAGE_INVALID");
    file = await open(join(dir, "sendgrid.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await file.stat(); if (!info.isFile() || info.size > 16000) return error("STORAGE_INVALID");
    const envelope = JSON.parse(await file.readFile("utf8")) as Envelope;
    if (envelope.version !== 1 || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1 || typeof envelope.encrypted !== "string" || typeof envelope.updatedBy !== "string" || !Number.isFinite(Date.parse(envelope.updatedAt))) return error("STORAGE_INVALID");
    const data = JSON.parse(decryptSecret(envelope.encrypted));
    if (!data || data.context !== "taxicrm-sendgrid-v1" || data.revision !== envelope.revision) return error("STORAGE_INVALID");
    return { envelope, config: data.config === null ? null : parseSettings(data.config) };
  } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; return error("STORAGE_UNAVAILABLE"); }
  finally { await file?.close(); }
}
export async function publicSettings() {
  const ready = await storageReady(); if (!ready) return { storageReady: false, configured: false, revision: 0 };
  const stored = await read();
  return stored?.config ? { storageReady: true, configured: true, revision: stored.envelope.revision, senderEmail: stored.config.senderEmail, senderName: stored.config.senderName, updatedAt: stored.envelope.updatedAt } : { storageReady: true, configured: false, revision: stored?.envelope.revision ?? 0 };
}
export async function saveSettings(input: unknown, actor: string) {
  if (!await storageReady()) return error("STORAGE_NOT_CONFIGURED");
  if (!input || typeof input !== "object" || Array.isArray(input)) return error("INVALID_SETTINGS");
  const x = input as Record<string, unknown>;
  if (Object.keys(x).some(k => !["senderEmail", "senderName", "apiKey", "expectedRevision"].includes(k)) || !Number.isSafeInteger(x.expectedRevision) || Number(x.expectedRevision) < 0 || !validateEmail(x.senderEmail) || typeof x.senderName !== "string" || !x.senderName.trim() || x.senderName.length > 100 || /[\x00-\x1f\x7f]/.test(x.senderName) || (x.apiKey !== undefined && x.apiKey !== "" && !validKey(x.apiKey)) || !actor || actor.length > 100) return error("INVALID_SETTINGS");
  const dir = directory(); await mkdir(dir, { recursive: true, mode: 0o700 });
  const root = await lstat(dir); if (!root.isDirectory() || root.isSymbolicLink()) return error("STORAGE_INVALID");
  let lock; try { lock = await open(join(dir, "sendgrid.lock"), "wx", 0o600); } catch { return error("STORAGE_BUSY"); }
  const tmp = join(dir, `.sendgrid-${randomUUID()}.tmp`); let file;
  try {
    const previous = await read(); if ((previous?.envelope.revision ?? 0) !== x.expectedRevision) return error("REVISION_CONFLICT");
    const apiKey = typeof x.apiKey === "string" && x.apiKey ? x.apiKey : previous?.config?.apiKey;
    if (!validKey(apiKey)) return error("KEY_REQUIRED");
    const revision = Number(x.expectedRevision) + 1;
    const config = parseSettings({ senderEmail: (x.senderEmail as string).trim(), senderName: (x.senderName as string).trim(), apiKey });
    const envelope: Envelope = { version: 1, revision, encrypted: encryptSecret(JSON.stringify({ context: "taxicrm-sendgrid-v1", revision, config })), updatedAt: new Date().toISOString(), updatedBy: actor };
    file = await open(tmp, "wx", 0o600); await file.writeFile(JSON.stringify(envelope)); await file.sync(); await file.close(); file = undefined; await rename(tmp, join(dir, "sendgrid.json"));
    const directoryHandle = await open(dir, constants.O_RDONLY); try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
  } finally { await file?.close(); await unlink(tmp).catch(() => {}); await lock.close(); await unlink(join(dir, "sendgrid.lock")); }
  return publicSettings();
}
export async function currentKey(expectedRevision: number) {
  const stored = await read(); if (!stored?.config || stored.envelope.revision !== expectedRevision) return error("REVISION_CONFLICT");
  return stored.config.apiKey;
}
export async function currentSendingConfig(expectedRevision: number) {
  const stored = await read(); if (!stored?.config || stored.envelope.revision !== expectedRevision) return error("REVISION_CONFLICT");
  return stored.config;
}

export async function removeSettings(expectedRevision: number, actor: string) {
  if (!await storageReady()) return error("STORAGE_NOT_CONFIGURED");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || !actor || actor.length > 100) return error("INVALID_REQUEST");
  const dir = directory(); let lock;
  try { lock = await open(join(dir, "sendgrid.lock"), "wx", 0o600); } catch { return error("STORAGE_BUSY"); }
  const tmp = join(dir, `.sendgrid-${randomUUID()}.tmp`); let file;
  try {
    const previous = await read(); if (!previous?.config || previous.envelope.revision !== expectedRevision) return error("REVISION_CONFLICT");
    const revision = expectedRevision + 1;
    const envelope: Envelope = { version: 1, revision, encrypted: encryptSecret(JSON.stringify({ context: "taxicrm-sendgrid-v1", revision, config: null })), updatedAt: new Date().toISOString(), updatedBy: actor };
    file = await open(tmp, "wx", 0o600); await file.writeFile(JSON.stringify(envelope)); await file.sync(); await file.close(); file = undefined; await rename(tmp, join(dir, "sendgrid.json"));
    const directoryHandle = await open(dir, constants.O_RDONLY); try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
  } finally { await file?.close(); await unlink(tmp).catch(() => {}); await lock.close(); await unlink(join(dir, "sendgrid.lock")); }
  return publicSettings();
}
