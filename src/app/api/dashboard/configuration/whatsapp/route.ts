import { NextResponse } from "next/server";
import { whatsappSettings, WhatsAppError } from "@/lib/integrations/whatsapp/settings";
import { listTemplates, templatePreview } from "@/lib/integrations/whatsapp/templates";
import { whatsappAccess, whatsappBody, whatsappOrigin, privateHeaders } from "@/lib/integrations/whatsapp/access";
import { reserveWhatsAppList } from "@/lib/integrations/whatsapp/limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof WhatsAppError ? error.code : "WHATSAPP_UNAVAILABLE" }, { status: error instanceof WhatsAppError ? error.status : 503, headers: privateHeaders });
}
export async function GET() {
  try {
    const access = await whatsappAccess();
    return NextResponse.json({ settings: whatsappSettings(), canManage: access.permissions.includes("integrations.manage") }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const access = await whatsappAccess(true); whatsappOrigin(request);
    const body = await whatsappBody(request);
    if (body.action === "preview" && Object.keys(body).every(k => ["action", "draft"].includes(k))) return NextResponse.json(templatePreview(body.draft), { headers: privateHeaders });
    if (body.action === "list" && Object.keys(body).length === 1) {
      release = reserveWhatsAppList(access.user.id);
      return NextResponse.json(await listTemplates(), { headers: privateHeaders });
    }
    throw new WhatsAppError("UNSUPPORTED_ACTION");
  } catch (error) { return failure(error); }
  finally { release?.(); }
}
