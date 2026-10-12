import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import { GET } from "../../src/app/api/internal/webhook-readiness/route";
test("release readiness requires authentication and performs a read-only configuration check", async () => {
  assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
  assert.equal(
    process.env.DATABASE_URL,
    "postgresql://taxicrm@127.0.0.1:5432/taxicrm",
  );
  const prior = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "synthetic-readiness-secret";
  const id = "synthetic-" + randomUUID();
  try {
    const config = await prisma.autocabWebhookConfiguration.create({
      data: {
        id,
        displayName: "Synthetic readiness",
        eventType: id,
        endpointSlug: id,
        isEnabled: false,
      },
    });
    assert.equal(
      (
        await GET(
          new Request(
            `http://localhost/api/internal/webhook-readiness?id=${id}`,
          ),
        )
      ).status,
      401,
    );
    const result = await GET(
      new Request(`http://localhost/api/internal/webhook-readiness?id=${id}`, {
        headers: { "x-cron-secret": process.env.CRON_SECRET },
      }),
    );
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), {
      migrationApplied: true,
      configurationExists: true,
      providerLinked: true,
      editorRouteRegistered: true,
    });
    assert.equal(
      (
        await prisma.autocabWebhookConfiguration.findUniqueOrThrow({
          where: { id },
        })
      ).isEnabled,
      config.isEnabled,
    );
  } finally {
    if (prior === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prior;
    await prisma.autocabWebhookConfiguration.deleteMany({ where: { id } });
    await prisma.$disconnect();
  }
});
