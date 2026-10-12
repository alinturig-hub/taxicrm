import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import {
  disableExistingIntegrations,
  enabledIntegrationCounts,
} from "../../src/lib/integrations/disable-configurations";
test("bulk disable is atomic, auditable and preserves settings and saved data", async () => {
  assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
  assert.equal(
    process.env.DATABASE_URL,
    "postgresql://taxicrm@127.0.0.1:5432/taxicrm",
  );
  const key = "synthetic-disable-" + randomUUID();
  const snapshots = await Promise.all([
    prisma.webhookProvider.findMany({ select: { id: true, isEnabled: true } }),
    prisma.autocabWebhookConfiguration.findMany({
      select: { id: true, isEnabled: true },
    }),
    prisma.apiEndpointConfiguration.findMany({
      select: { id: true, isEnabled: true },
    }),
    prisma.autocabApiConfiguration.findMany({
      select: { id: true, isEnabled: true, driverSyncEnabled: true },
    }),
    prisma.geoapifyApiConfiguration.findMany({
      select: { id: true, isEnabled: true },
    }),
    prisma.smsGatewayConfiguration.findMany({
      select: { id: true, isEnabled: true },
    }),
  ]);
  const user = await prisma.user.create({
    data: {
      email: key + "@example.test",
      name: key,
      passwordHash: "synthetic",
      role: "ADMIN",
    },
  });
  try {
    await prisma.webhookProvider.create({
      data: {
        id: key,
        name: key,
        baseUrl: "https://example.test",
        isEnabled: true,
      },
    });
    await prisma.autocabWebhookConfiguration.create({
      data: {
        id: key,
        providerId: key,
        displayName: key,
        eventType: key,
        endpointSlug: key,
        isEnabled: true,
      },
    });
    await prisma.apiEndpointConfiguration.create({
      data: {
        id: key,
        provider: key,
        name: key,
        url: "https://example.test/" + key,
        isEnabled: true,
        storeRecords: true,
      },
    });
    await prisma.apiEndpointRecord.create({
      data: { endpointId: key, externalId: key, data: { synthetic: true } },
    });
    await prisma.autocabApiConfiguration.create({
      data: {
        id: key,
        provider: key,
        isEnabled: true,
        driverSyncEnabled: true,
        apiKeyEncrypted: "synthetic-preserved-secret",
      },
    });
    await prisma.geoapifyApiConfiguration.create({
      data: {
        id: key,
        provider: key,
        isEnabled: true,
        apiKeyEncrypted: "synthetic-preserved-secret",
      },
    });
    await prisma.smsGatewayConfiguration.create({
      data: {
        id: key,
        endpoint: "https://example.test",
        signedParametersEncrypted: "synthetic-preserved-secret",
        isEnabled: true,
      },
    });
    const before = await enabledIntegrationCounts();
    const counts = await disableExistingIntegrations(user.id);
    assert.deepEqual(counts, before);
    assert.equal(
      Object.values(await enabledIntegrationCounts()).reduce(
        (a, b) => a + b,
        0,
      ),
      0,
    );
    assert.equal(
      (
        await prisma.autocabApiConfiguration.findUniqueOrThrow({
          where: { id: key },
        })
      ).apiKeyEncrypted,
      "synthetic-preserved-secret",
    );
    assert.equal(
      (
        await prisma.apiEndpointRecord.findFirstOrThrow({
          where: { endpointId: key },
        })
      ).externalId,
      key,
    );
    const audit = await prisma.administrationAuditEvent.findFirstOrThrow({
      where: {
        actorUserId: user.id,
        action: "INTEGRATION_CONFIGURATIONS_DISABLED",
      },
    });
    assert.deepEqual(audit.evidence, counts);
    await prisma.webhookProvider.update({
      where: { id: key },
      data: { isEnabled: true },
    });
    await assert.rejects(() =>
      disableExistingIntegrations("synthetic-nonexistent-actor"),
    );
    assert.equal(
      (await prisma.webhookProvider.findUniqueOrThrow({ where: { id: key } }))
        .isEnabled,
      true,
    );
  } finally {
    await prisma.administrationAuditEvent.deleteMany({
      where: { actorUserId: user.id },
    });
    await prisma.apiEndpointRecord.deleteMany({ where: { endpointId: key } });
    await prisma.autocabWebhookConfiguration.deleteMany({ where: { id: key } });
    await prisma.webhookProvider.deleteMany({ where: { id: key } });
    await prisma.apiEndpointConfiguration.deleteMany({ where: { id: key } });
    await prisma.autocabApiConfiguration.deleteMany({ where: { id: key } });
    await prisma.geoapifyApiConfiguration.deleteMany({ where: { id: key } });
    await prisma.smsGatewayConfiguration.deleteMany({ where: { id: key } });
    type RestoreData = { isEnabled: boolean; driverSyncEnabled?: boolean };
    const restores: ((id: string, data: RestoreData) => Promise<unknown>)[] = [
      (id, data) => prisma.webhookProvider.update({ where: { id }, data }),
      (id, data) =>
        prisma.autocabWebhookConfiguration.update({ where: { id }, data }),
      (id, data) =>
        prisma.apiEndpointConfiguration.update({ where: { id }, data }),
      (id, data) =>
        prisma.autocabApiConfiguration.update({ where: { id }, data }),
      (id, data) =>
        prisma.geoapifyApiConfiguration.update({ where: { id }, data }),
      (id, data) =>
        prisma.smsGatewayConfiguration.update({ where: { id }, data }),
    ];
    for (let i = 0; i < restores.length; i++)
      for (const { id, ...data } of snapshots[i]) await restores[i](id, data);
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
