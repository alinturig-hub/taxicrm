import { constants } from "node:fs";
import { open, readdir, rename, unlink } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { currentSendingConfig, SendgridSettingsError } from "./store";

type Claim = { version: 1; digest: string; status: "STARTED" | "ACCEPTED" | "REJECTED" | "UNKNOWN" };
const fail = (code: string): never => { throw new SendgridSettingsError(code); };
async function syncDir(dir: string) { const h = await open(dir, constants.O_RDONLY); try { await h.sync(); } finally { await h.close(); } }
/** Exactly one provider attempt for a user-confirmed request; no automatic retries. */
export async function sendTest(input: unknown, transport: typeof fetch = fetch) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("INVALID_REQUEST");
  const x = input as Record<string, unknown>;
  if (Object.keys(x).sort().join(",") !== "confirm,expectedRevision,recipient,requestId" || x.confirm !== true || !Number.isSafeInteger(x.expectedRevision) || Number(x.expectedRevision) < 1 || typeof x.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x.requestId) || typeof x.recipient !== "string" || x.recipient.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x.recipient)) return fail("INVALID_REQUEST");
  const dir = process.env.SENDGRID_CONFIG_DIR;
  if (!dir || !isAbsolute(dir)) return fail("STORAGE_NOT_CONFIGURED");
  const config = await currentSendingConfig(Number(x.expectedRevision));
  const digest = createHash("sha256").update(JSON.stringify([Number(x.expectedRevision), x.recipient])).digest("hex");
  const claimPath = join(dir, `test-${x.requestId.toLowerCase()}.json`);
  const existing = async () => {
    let file;
    try {
      file = await open(claimPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const info = await file.stat(); if (!info.isFile() || info.size > 2048) return fail("TEST_STATUS_UNKNOWN");
      const record = JSON.parse(await file.readFile("utf8")) as Claim;
      if (record.version !== 1 || !/^[a-f0-9]{64}$/.test(record.digest) || !["STARTED", "ACCEPTED", "REJECTED", "UNKNOWN"].includes(record.status)) return fail("TEST_STATUS_UNKNOWN");
      if (record.digest !== digest) return fail("TEST_REQUEST_CONFLICT");
      return { state: record.status === "STARTED" ? "UNKNOWN" as const : record.status, replay: true };
    } catch (e) { if (e instanceof SendgridSettingsError) throw e; return fail("TEST_STATUS_UNKNOWN"); }
    finally { await file?.close(); }
  };
  const files = await readdir(dir);
  if (files.filter(name => /^test-[0-9a-f-]+\.json$/i.test(name)).length >= 1000 && !files.includes(`test-${x.requestId.toLowerCase()}.json`)) return fail("TEST_CAPACITY_REACHED");
  let claim;
  try { claim = await open(claimPath, "wx", 0o600); } catch (e) { if ((e as NodeJS.ErrnoException).code === "EEXIST") return existing(); return fail("STORAGE_UNAVAILABLE"); }
  try { await claim.writeFile(JSON.stringify({ version: 1, digest, status: "STARTED" } satisfies Claim)); await claim.sync(); }
  finally { await claim.close(); }
  await syncDir(dir);
  let state: "ACCEPTED" | "REJECTED" | "UNKNOWN" = "UNKNOWN";
  try {
    const response = await transport("https://api.sendgrid.com/v3/mail/send", {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ personalizations: [{ to: [{ email: x.recipient }] }], from: { email: config.senderEmail, name: config.senderName }, subject: "TaxiCRM SendGrid test", content: [{ type: "text/plain", value: "This is a test email from TaxiCRM." }] }),
    });
    state = response.status === 202 ? "ACCEPTED" : [400, 401, 403, 404, 413, 422].includes(response.status) ? "REJECTED" : "UNKNOWN";
  } catch { state = "UNKNOWN"; }
  const temporary = join(dir, `.test-${randomUUID()}.tmp`); let file;
  try { file = await open(temporary, "wx", 0o600); await file.writeFile(JSON.stringify({ version: 1, digest, status: state } satisfies Claim)); await file.sync(); await file.close(); file = undefined; await rename(temporary, claimPath); await syncDir(dir); }
  catch { state = "UNKNOWN"; }
  finally { await file?.close(); await unlink(temporary).catch(() => {}); }
  return { state, replay: false };
}
