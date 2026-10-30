import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/security/encryption";
import { completionTemplate, eligibleCompletion, whatsappPhone } from "./whatsapp-policy";

/** Unique booking claim is committed BEFORE contacting Meta. Unknown outcomes never auto-retry. */
export async function sendJourneyCompleteWhatsApp(bookingId: string, webhookEventId: string, receivedAt: Date, db: typeof prisma = prisma) {
  const config = await db.whatsAppConfiguration.findUnique({ where: { id: "journey-complete" } });
  if (!config?.enabled) return;
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: {
    status: true, completedAt: true, telephoneNumber: true, customerName: true, externalId: true,
  } });
  if (!booking || !eligibleCompletion({ ...booking, receivedAt, enabledSince: config.enabledSince })) return;
  const phone = whatsappPhone(booking.telephoneNumber || "");
  if (!phone) return;
  const consent = await db.whatsAppConsent.findUnique({ where: { phone } });
  if (!consent || consent.revokedAt) return;
  // Decrypt before claiming: missing encryption configuration should not consume the booking.
  const token = decryptSecret(config.encryptedToken);
  try {
    await db.whatsAppDelivery.create({ data: { bookingId, webhookEventId, phone, status: "SENDING" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return;
    throw error;
  }
  // Recheck disable/revocation after claiming. A disabled workflow must not continue queued sends.
  const [current, permission] = await Promise.all([
    db.whatsAppConfiguration.findUnique({ where: { id: config.id } }),
    db.whatsAppConsent.findUnique({ where: { phone } }),
  ]);
  if (!current?.enabled || !permission || permission.revokedAt) {
    await db.whatsAppDelivery.update({ where: { bookingId }, data: { status: "SKIPPED", errorCode: "DISABLED_OR_REVOKED" } });
    return;
  }
  let status = "UNKNOWN", errorCode: string | null = null, providerMessageId: string | null = null;
  try {
    const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone.slice(1), type: "template",
        template: completionTemplate(config.templateName, config.language, booking.customerName, booking.externalId) }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => null) as { messages?: { id?: string }[] } | null;
    if (response.ok && body?.messages?.[0]?.id) {
      status = "ACCEPTED"; providerMessageId = body.messages[0].id;
    } else {
      status = response.status >= 400 && response.status < 500 ? "REJECTED" : "UNKNOWN";
      errorCode = `HTTP_${response.status}`;
    }
  } catch {
    errorCode = "NETWORK_OR_TIMEOUT";
  }
  await db.whatsAppDelivery.update({ where: { bookingId }, data: { status, providerMessageId, errorCode } });
}
