import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { requireAdministrationPermission } from "@/lib/administration-access";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/security/encryption";
import { whatsappPhone } from "@/lib/integrations/whatsapp-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function access() {
  const session = await getServerSession(authOptions);
  return requireAdministrationPermission(session?.user?.email, "integrations.manage");
}
export async function GET() {
  if (!await access()) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const config = await prisma.whatsAppConfiguration.findUnique({ where: { id: "journey-complete" },
      select: { enabled: true, phoneNumberId: true, templateName: true, language: true, graphVersion: true } });
    const deliveries = await prisma.whatsAppDelivery.findMany({ take: 30, orderBy: { createdAt: "desc" },
      select: { id: true, bookingId: true, status: true, errorCode: true, createdAt: true } });
    const consentCount = await prisma.whatsAppConsent.count({ where: { revokedAt: null } });
    return NextResponse.json({ config, deliveries, consentCount, tokenSaved: !!config }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "WhatsApp storage is unavailable. Apply the WhatsApp migration before setup." }, { status: 503 });
  }
}
export async function PUT(request: Request) {
  const user = await access();
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    const body = JSON.parse(raw);
    if (body.action === "consent") {
      const phone = typeof body.phone === "string" ? whatsappPhone(body.phone) : null;
      if (!phone || typeof body.granted !== "boolean")
        return NextResponse.json({ error: "Supply a valid international phone number and consent state." }, { status: 400 });
      if (body.granted && (typeof body.evidence !== "string" || body.evidence.trim().length < 5 || body.evidence.length > 1000))
        return NextResponse.json({ error: "Record where and when the customer opted in." }, { status: 400 });
      if (body.granted) {
        await prisma.whatsAppConsent.upsert({ where: { phone },
          create: { phone, evidence: body.evidence.trim(), actorUserId: user.user.id },
          update: { evidence: body.evidence.trim(), actorUserId: user.user.id, grantedAt: new Date(), revokedAt: null } });
      } else {
        await prisma.whatsAppConsent.updateMany({ where: { phone }, data: { revokedAt: new Date(), actorUserId: user.user.id } });
      }
      return NextResponse.json({ success: true });
    }
    if (body.action !== "configuration" || typeof body.enabled !== "boolean" ||
        typeof body.phoneNumberId !== "string" || !/^\d{5,30}$/.test(body.phoneNumberId) ||
        typeof body.templateName !== "string" || !/^[a-z0-9_]{1,100}$/.test(body.templateName) ||
        typeof body.language !== "string" || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(body.language) ||
        typeof body.graphVersion !== "string" || !/^v\d{1,2}\.0$/.test(body.graphVersion) ||
        (body.accessToken !== undefined && (typeof body.accessToken !== "string" || body.accessToken.length > 5000)))
      return NextResponse.json({ error: "Check the Meta phone number ID, template, language and API version." }, { status: 400 });
    const existing = await prisma.whatsAppConfiguration.findUnique({ where: { id: "journey-complete" } });
    const encryptedToken = body.accessToken?.trim() ? encryptSecret(body.accessToken.trim()) : existing?.encryptedToken;
    if (!encryptedToken) return NextResponse.json({ error: "A Meta access token is required." }, { status: 400 });
    const data = { enabled: body.enabled, phoneNumberId: body.phoneNumberId, templateName: body.templateName,
      language: body.language, graphVersion: body.graphVersion, encryptedToken,
      enabledSince: body.enabled ? (existing?.enabled ? existing.enabledSince : new Date()) : null };
    await prisma.whatsAppConfiguration.upsert({ where: { id: "journey-complete" }, create: { id: "journey-complete", ...data }, update: data });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Settings could not be saved. Check storage and integration encryption configuration." }, { status: 400 });
  }
}
