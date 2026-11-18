import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import { publicSettings, saveSettings, removeSettings, currentKey, SendgridSettingsError } from "@/lib/communications/sendgrid/store";
import { checkSendgridKey } from "@/lib/communications/sendgrid/check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const result = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });
async function allowed() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return requireAdministrationPermission(session.user.email, "configuration.manage");
}
function sameOrigin(request: Request) {
  try { return request.headers.get("origin") === new URL(process.env.NEXTAUTH_URL || request.url).origin; } catch { return false; }
}
async function body(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new SendgridSettingsError("INVALID_REQUEST");
  let size = 0, text = ""; const decoder = new TextDecoder();
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 4096) { await reader.cancel(); throw new SendgridSettingsError("INVALID_REQUEST"); } text += decoder.decode(part.value, { stream: true }); }
  try { return JSON.parse(text + decoder.decode()) as unknown; } catch { throw new SendgridSettingsError("INVALID_REQUEST"); }
}
function failed(e: unknown) {
  const code = e instanceof SendgridSettingsError ? e.code : "SETTINGS_UNAVAILABLE";
  return result({ error: code }, code === "REVISION_CONFLICT" || code === "STORAGE_BUSY" ? 409 : code === "INVALID_REQUEST" || code === "INVALID_SETTINGS" || code === "KEY_REQUIRED" ? 400 : 503);
}
export async function GET() { if (!await allowed()) return result({ error: "FORBIDDEN" }, 403); try { return result(await publicSettings()); } catch (e) { return failed(e); } }
export async function PUT(request: Request) {
  const access = await allowed(); if (!access) return result({ error: "FORBIDDEN" }, 403);
  if (!sameOrigin(request)) return result({ error: "FORBIDDEN" }, 403);
  try { return result(await saveSettings(await body(request), access.user.id)); } catch (e) { return failed(e); }
}
export async function DELETE(request: Request) {
  const access = await allowed(); if (!access) return result({ error: "FORBIDDEN" }, 403);
  if (!sameOrigin(request)) return result({ error: "FORBIDDEN" }, 403);
  try {
    const value = await body(request);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "confirm,expectedRevision" || (value as {confirm?: unknown}).confirm !== true || !Number.isSafeInteger((value as {expectedRevision?: unknown}).expectedRevision)) throw new SendgridSettingsError("INVALID_REQUEST");
    return result(await removeSettings((value as {expectedRevision: number}).expectedRevision, access.user.id));
  } catch (e) { return failed(e); }
}
let testing = false;
export async function POST(request: Request) {
  if (!await allowed()) return result({ error: "FORBIDDEN" }, 403);
  if (!sameOrigin(request)) return result({ error: "FORBIDDEN" }, 403);
  if (testing) return result({ error: "TEST_BUSY" }, 429);
  testing = true;
  try {
    const value = await body(request);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).join(",") !== "expectedRevision" || !Number.isSafeInteger((value as { expectedRevision?: unknown }).expectedRevision)) throw new SendgridSettingsError("INVALID_REQUEST");
    const revision = (value as { expectedRevision: number }).expectedRevision;
    const key = await currentKey(revision);
    const checked = await checkSendgridKey(key);
    if (await currentKey(revision) !== key) throw new SendgridSettingsError("REVISION_CONFLICT");
    return result(checked);
  } catch (e) { return failed(e); } finally { testing = false; }
}
