import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import { changeModuleState, loadModuleState } from "@/modules/core/activation/store";
import { isSwitchable } from "@/modules/core/activation/model";
export const dynamic = "force-dynamic";
async function access() {
  return requireAdministrationPermission((await getServerSession(authOptions))?.user?.email, "configuration.manage");
}
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  if (!await access()) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers });
  try { return NextResponse.json(await loadModuleState(), { headers }); }
  catch { return NextResponse.json({ error: "MODULE_STATE_UNAVAILABLE" }, { status: 503, headers }); }
}
export async function PUT(request: NextRequest) {
  const user = await access();
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(process.env.NEXTAUTH_URL || request.url).origin)
    return NextResponse.json({ error: "ORIGIN_REQUIRED" }, { status: 403, headers });
  let input;
  try {
    if (Number(request.headers.get("content-length") || 0) > 2048) throw Error("Invalid request");
    const text = await request.text(); if (Buffer.byteLength(text, "utf8") > 2048) throw Error("Invalid request");
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).sort().join() !== "enabled,moduleId,revision" ||
        !Number.isSafeInteger(body.revision) || body.revision < 0 || !isSwitchable(body.moduleId) || typeof body.enabled !== "boolean") throw Error("Invalid module change");
    input = { revision: body.revision as number, moduleId: body.moduleId, enabled: body.enabled as boolean };
  } catch { return NextResponse.json({ error: "INVALID_MODULE_CHANGE" }, { status: 400, headers }); }
  try { return NextResponse.json(await changeModuleState(input, user.user.id), { headers }); }
  catch (error) {
    if (error instanceof Error && error.message === "MODULE_VERSION_CONFLICT")
      return NextResponse.json({ error: "MODULE_VERSION_CONFLICT", message: "Settings changed in another session. Reload settings before trying again." }, { status: 409, headers });
    return NextResponse.json({ error: "MODULE_STATE_UNAVAILABLE" }, { status: 503, headers });
  }
}
