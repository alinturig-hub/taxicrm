import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import {
  previewLocalDataset,
  saveLocalDataset,
  localDatasetInput,
} from "../../src/lib/integrations/local/datasets";
import { syncGenericApiEndpoint } from "../../src/lib/integrations/autocab/generic-api-sync/sync";
test("local imports require unchanged actor-bound previews, retain JSON and do not sync as Autocab", async () => {
  assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
  assert.equal(
    process.env.DATABASE_URL,
    "postgresql://taxicrm@127.0.0.1:5432/taxicrm",
  );
  const key = "synthetic-local-" + randomUUID();
  const user = await prisma.user.create({
    data: {
      email: key + "@example.test",
      name: key,
      passwordHash: "synthetic",
      role: "ADMIN",
    },
  });
  try {
    const body = {
      name: key,
      recordKey: "id",
      payload: [
        { id: "synthetic-zone-1", name: "Synthetic north", fare: null },
        { id: "synthetic-zone-2", name: "Synthetic south", fare: 0 },
      ],
    };
    const preview = previewLocalDataset(user.id, body);
    assert.equal(preview.records, 2);
    await assert.rejects(() =>
      saveLocalDataset(user.id, {
        ...body,
        payload: [{ id: "changed" }],
        previewToken: preview.previewToken,
      }),
    );
    await assert.rejects(() =>
      saveLocalDataset("different-actor", {
        ...body,
        previewToken: preview.previewToken,
      }),
    );
    await assert.rejects(() =>
      saveLocalDataset(user.id, {
        ...body,
        recordKey: "name",
        previewToken: preview.previewToken,
      }),
    );
    await assert.rejects(() =>
      saveLocalDataset(user.id, {
        ...body,
        name: "Changed name",
        previewToken: preview.previewToken,
      }),
    );
    assert.throws(
      () =>
        localDatasetInput({
          ...body,
          recordKey: "",
          payload: "x".repeat(512 * 1024 + 1),
        }),
      /512 KB/,
    );
    const saved = await saveLocalDataset(user.id, {
      ...body,
      previewToken: preview.previewToken,
    });
    const retried = await saveLocalDataset(user.id, {
      ...body,
      previewToken: preview.previewToken,
    });
    assert.equal(retried.id, saved.id);
    assert.equal(retried.alreadySaved, true);
    const dataset = await prisma.apiEndpointConfiguration.findUniqueOrThrow({
      where: { id: saved.id },
    });
    assert.equal(dataset.provider, "LOCAL");
    assert.equal(dataset.isEnabled, false);
    const records = await prisma.apiEndpointRecord.findMany({
      where: { endpointId: saved.id },
      orderBy: { externalId: "asc" },
    });
    assert.deepEqual(
      records.map((record) => record.data),
      body.payload,
    );
    await assert.rejects(
      () => syncGenericApiEndpoint(saved.id),
      /not an Autocab/,
    );
    assert.equal(
      await prisma.administrationAuditEvent.count({
        where: { actorUserId: user.id, action: "LOCAL_DATASET_IMPORTED" },
      }),
      1,
    );
    assert.throws(
      () =>
        localDatasetInput({
          ...body,
          payload: [{ id: "same" }, { id: "same" }],
        }),
      /Duplicate/,
    );
    assert.throws(
      () =>
        localDatasetInput({
          ...body,
          payload: Array.from({ length: 501 }, (_, id) => ({ id })),
        }),
      /500 records/,
    );
  } finally {
    await prisma.apiEndpointConfiguration.deleteMany({
      where: { provider: "LOCAL", name: key },
    });
    await prisma.administrationAuditEvent.deleteMany({
      where: { actorUserId: user.id },
    });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
