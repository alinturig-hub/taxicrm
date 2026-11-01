import test from "node:test";
import assert from "node:assert/strict";
import { completionTemplate, eligibleCompletion, whatsappPhone } from "./whatsapp-policy";

test("normalises UK and international numbers without guessing other local formats", () => {
  assert.equal(whatsappPhone("07700 900123"), "+447700900123");
  assert.equal(whatsappPhone("0044 7700 900123"), "+447700900123");
  assert.equal(whatsappPhone("+40 (721) 123-456"), "+40721123456");
  for (const value of ["", "1234", "+4407700900123x", "07700abc123", "447700900123"])
    assert.equal(whatsappPhone(value), null);
});
test("requires a new completed journey; suppresses cancellation, stale and pre-activation replay", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const input = { status: "COMPLETED", completedAt: new Date("2026-10-30T11:59:00Z"), receivedAt: new Date("2026-10-30T11:59:01Z"), enabledSince: new Date("2026-10-30T11:00:00Z") };
  assert.equal(eligibleCompletion(input, now), true);
  for (const patch of [
    { status: "CANCELLED" }, { status: "NO_FARE" }, { completedAt: null }, { enabledSince: null },
    { completedAt: new Date("2026-10-29T12:00:00Z") },
    { receivedAt: new Date("2026-10-29T12:00:00Z") },
    { enabledSince: now }, { completedAt: new Date("2026-10-31T12:00:00Z") },
  ]) assert.equal(eligibleCompletion({ ...input, ...patch }, now), false);
});
test("template body uses first name and booking reference in approved parameter order", () => {
  const template = completionTemplate("journey_completed", "en_GB", "Alin Turi", "12345");
  assert.deepEqual(template.components[0].parameters.map(p => p.text), ["Alin", "12345"]);
  assert.equal(completionTemplate("x", "en", null, "1").components[0].parameters[0].text, "Customer");
});

test("sender claims once, suppresses no-consent customers and does not retry ambiguous outcomes", async (t) => {
  process.env.DATABASE_URL ||= "postgresql://unused:unused@127.0.0.1:1/unused";
  process.env.INTEGRATION_ENCRYPTION_KEY = "ab".repeat(32);
  const { prisma } = await import("@/lib/prisma");
  const { encryptSecret } = await import("@/lib/security/encryption");
  const { sendJourneyCompleteWhatsApp } = await import("./whatsapp");
  const now = new Date(), since = new Date(now.getTime() - 60_000);
  let enabled = true, consent = true, claimed = false, calls = 0;
  const updates: { status: string; errorCode?: string | null }[] = [];
  const db = {
    whatsAppConfiguration: { findUnique: async () => ({
      id: "journey-complete", enabled, enabledSince: since, phoneNumberId: "123456789",
      templateName: "journey_completed", language: "en_GB", graphVersion: "v23.0", encryptedToken: encryptSecret("test-token"),
    }) },
    booking: { findUnique: async () => ({ status: "COMPLETED", completedAt: now,
      telephoneNumber: "07700900123", customerName: "Customer Test", externalId: "42" }) },
    whatsAppConsent: { findUnique: async () => consent ? { revokedAt: null } : null },
    whatsAppDelivery: {
      create: async () => {
        if (claimed) throw Object.assign(new Error("duplicate"), { code: "P2002" });
        claimed = true; return {};
      },
      update: async ({ data }: { data: typeof updates[number] }) => { updates.push(data); return {}; },
    },
  } as unknown as typeof prisma;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    calls++;
    const body = JSON.parse(init.body as string);
    assert.equal(body.to, "447700900123");
    assert.equal(body.type, "template");
    return Response.json({ messages: [{ id: "wamid.test" }] });
  });
  enabled = false; await sendJourneyCompleteWhatsApp("booking", "event", now, db);
  assert.equal(claimed, false);
  enabled = true; consent = false; await sendJourneyCompleteWhatsApp("booking", "event", now, db);
  assert.equal(claimed, false); assert.equal(calls, 0);
  consent = true;
  await Promise.all([sendJourneyCompleteWhatsApp("booking", "event", now, db), sendJourneyCompleteWhatsApp("booking", "replay", now, db)]);
  assert.equal(calls, 1); assert.equal(updates[0].status, "ACCEPTED");
  claimed = false;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw Error("timeout"); });
  await sendJourneyCompleteWhatsApp("booking2", "event", now, db);
  await sendJourneyCompleteWhatsApp("booking2", "replay", now, db);
  assert.equal(calls, 2); assert.equal(updates.at(-1)?.status, "UNKNOWN");
  assert.equal(updates.at(-1)?.errorCode, "NETWORK_OR_TIMEOUT");
});
