import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
test("provider migration preserves existing configurations and original event payloads", async () => {
  assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
  assert.equal(
    process.env.DATABASE_URL,
    "postgresql://taxicrm@127.0.0.1:5432/taxicrm",
  );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA synthetic_provider_migration");
    await client.query("SET LOCAL search_path TO synthetic_provider_migration");
    await client.query(
      'CREATE TABLE "AutocabWebhookConfiguration" ("id" TEXT PRIMARY KEY, "endpointSlug" TEXT NOT NULL)',
    );
    await client.query(
      'CREATE TABLE "WebhookEvent" ("id" TEXT PRIMARY KEY, "payload" JSONB NOT NULL)',
    );
    await client.query(
      'INSERT INTO "AutocabWebhookConfiguration" VALUES ($1,$2)',
      ["synthetic-existing", "synthetic-created"],
    );
    await client.query('INSERT INTO "WebhookEvent" VALUES ($1,$2::jsonb)', [
      "synthetic-event",
      JSON.stringify({ Fare: 12.34, synthetic: true }),
    ]);
    await client.query(
      await readFile(
        new URL(
          "../../prisma/migrations/20261012100000_webhook_providers/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const config = (
      await client.query('SELECT * FROM "AutocabWebhookConfiguration"')
    ).rows[0];
    assert.deepEqual(config, {
      id: "synthetic-existing",
      endpointSlug: "synthetic-created",
      providerId: "autocab",
    });
    assert.deepEqual(
      (await client.query('SELECT "payload" FROM "WebhookEvent"')).rows[0]
        .payload,
      { Fare: 12.34, synthetic: true },
    );
    assert.equal(
      (await client.query('SELECT "isEnabled" FROM "WebhookProvider"')).rows[0]
        .isEnabled,
      true,
    );
    await assert.rejects(() =>
      client.query('DELETE FROM "WebhookProvider" WHERE id=$1', ["autocab"]),
    );
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
