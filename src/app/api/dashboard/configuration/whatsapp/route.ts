import {isBookingTemplate} from "@/lib/integrations/whatsapp/template-purpose";
import { editTemplate } from "@/lib/integrations/whatsapp/template-edit";
import { providerCapabilities } from "@/lib/integrations/whatsapp/providers";
import { NextResponse } from "next/server";
import { whatsappSettings, WhatsAppError } from "@/lib/integrations/whatsapp/settings";
import { listTemplates, templatePreview, submitTemplate } from "@/lib/integrations/whatsapp/templates";
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
    return NextResponse.json({ settings: whatsappSettings(), providers: [providerCapabilities("META"), providerCapabilities("COMBOT")], canManage: access.permissions.includes("integrations.manage") }, { headers: privateHeaders });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const access = await whatsappAccess(true); whatsappOrigin(request);
    const body = await whatsappBody(request);
    if (body.action === "preview" && Object.keys(body).every(k => ["action", "draft"].includes(k))) return NextResponse.json(templatePreview(body.draft), { headers: privateHeaders });
    if (["edit","submit"].includes(String(body.action)) && isBookingTemplate(templatePreview(body.draft).payload.name)) throw new WhatsAppError("OPERATIONAL_TEMPLATE_MANAGED_BY_NAC",409);
    if (body.action === "edit" && body.confirmSubmission === true && Object.keys(body).every(k => ["action", "draft", "confirmSubmission", "templateId"].includes(k))) {
      release = reserveWhatsAppList(access.user.id);
      return NextResponse.json(await editTemplate(body.templateId, body.draft), { headers: privateHeaders });
    }
    if (body.action === "submit" && body.confirmSubmission === true && Object.keys(body).every(k => ["action", "draft", "confirmSubmission"].includes(k))) {
      release = reserveWhatsAppList(access.user.id);
      return NextResponse.json(await submitTemplate(body.draft), { headers: privateHeaders });
    }
    if (body.action === "list" && Object.keys(body).length === 1) {
      release = reserveWhatsAppList(access.user.id);
      return NextResponse.json(await listTemplates(), { headers: privateHeaders });
    }
    throw new WhatsAppError("UNSUPPORTED_ACTION");
  } catch (error) { return failure(error); }
  finally { release?.(); }
}
