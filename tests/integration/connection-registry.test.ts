import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { prisma } from "@/lib/prisma";
import { parseDraftRequest, saveConnectionDraft } from "@/lib/integrations/connection-registry";

assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
assert.equal(process.env.DATABASE_URL, "postgresql://taxicrm@127.0.0.1:5432/taxicrm");

test("draft registry preserves ownership, handles retries and isolates external references by connection", async () => {
  const actor = `synthetic-connection-${randomUUID()}`;
  const requestId = randomUUID();
  const input = { requestId, companyName: "Synthetic company", source: "NEEDACABPLUS", storage: "CURRENT_DATABASE" };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("External requests forbidden"); };
  try {
    assert.throws(() => parseDraftRequest({ ...input, status: "ACTIVE" }));
    assert.throws(() => parseDraftRequest({ ...input, apiKey: "synthetic-not-a-secret" }));
    const [a, retry] = await Promise.all([saveConnectionDraft(actor, input), saveConnectionDraft(actor, input)]);
    assert.equal(a.id, retry.id);
    assert.equal(a.status, "DRAFT");
    assert.equal("credentialCiphertext" in a, false);
    assert.equal((a.plan as Record<string, unknown>).preserveExistingConnection, true);
    await assert.rejects(saveConnectionDraft(actor, { ...input, source: "AUTOCAB" }), /another plan/);
    const b = await saveConnectionDraft(actor, { ...input, requestId: randomUUID(), source: "AUTOCAB" });
    const c = await saveConnectionDraft(actor + "-other", input);
    assert.notEqual(a.id, c.id);
    const row = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: a.id } });
    assert.equal(row.credentialCiphertext, null);
    assert.deepEqual(row.ownershipPolicy, { activationAllowed: false, preserveExistingConnection: true });
    const reference = { entityType: "BOOKING", externalId: "synthetic-booking-42", canonicalId: "synthetic-canonical-42" };
    await prisma.connectionExternalReference.create({ data: { ...reference, connectionId: a.id } });
    await prisma.connectionExternalReference.create({ data: { ...reference, connectionId: b.id } });
    await assert.rejects(prisma.connectionExternalReference.create({ data: { ...reference, connectionId: a.id } }));
    await assert.rejects(prisma.connectionExternalReference.create({ data: { ...reference, connectionId: "missing-synthetic-connection" } }));
    await assert.rejects(prisma.integrationConnection.delete({ where: { id: a.id } }));
  } finally {
    globalThis.fetch = originalFetch;
    const rows = await prisma.integrationConnection.findMany({ where: { createdById: { startsWith: actor } }, select: { id: true } });
    await prisma.connectionExternalReference.deleteMany({ where: { connectionId: { in: rows.map(row => row.id) } } });
    await prisma.integrationConnection.deleteMany({ where: { createdById: { startsWith: actor } } });
    await prisma.$disconnect();
  }
});
