import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import { sendTest } from "@/lib/communications/sendgrid/send-test";
import { SendgridSettingsError } from "@/lib/communications/sendgrid/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const result = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !await requireAdministrationPermission(session.user.email, "configuration.manage")) return result({ error: "FORBIDDEN" }, 403);
  try { if (request.headers.get("origin") !== new URL(process.env.NEXTAUTH_URL || request.url).origin) return result({ error: "FORBIDDEN" }, 403); } catch { return result({ error: "FORBIDDEN" }, 403); }
  try {
    const reader = request.body?.getReader(); if (!reader) throw new SendgridSettingsError("INVALID_REQUEST");
    let size = 0, value = ""; const decoder = new TextDecoder();
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 2048) { await reader.cancel(); throw new SendgridSettingsError("INVALID_REQUEST"); } value += decoder.decode(part.value, { stream: true }); }
    let input: unknown; try { input = JSON.parse(value + decoder.decode()); } catch { throw new SendgridSettingsError("INVALID_REQUEST"); }
    return result(await sendTest(input));
  } catch (e) {
    const code = e instanceof SendgridSettingsError ? e.code : "TEST_STATUS_UNKNOWN";
    return result({ error: code }, code === "INVALID_REQUEST" ? 400 : code === "REVISION_CONFLICT" || code === "TEST_REQUEST_CONFLICT" ? 409 : 503);
  }
}
