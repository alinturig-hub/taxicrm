import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {test} from "node:test";
import pg from "pg";
import {applySmsSchema} from "../../scripts/sms-schema-bootstrap.mjs";
if (process.env.TAXICRM_SYNTHETIC_TESTS !== "1" || process.env.DATABASE_URL !== "postgresql://taxicrm@127.0.0.1:5432/taxicrm") throw new Error("Requires opted-in isolated database.");
test("approved migration rolls back fully on conflict and applies idempotently to a fresh synthetic database", async () => {
  const original = process.env.DATABASE_URL!;
  const database = `sms_synthetic_${randomBytes(8).toString("hex")}`;
  const admin = new pg.Client({connectionString: original});
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  const url = `postgresql://taxicrm@127.0.0.1:5432/${database}`;
  const client = new pg.Client({connectionString: url});
  await client.connect();
  try {
    await client.query('CREATE TABLE "_prisma_migrations" (id text primary key, checksum text not null, finished_at timestamp, rolled_back_at timestamp, migration_name text not null, started_at timestamp, applied_steps_count integer)');
    await client.query('CREATE TABLE "NotificationDelivery" (id text)');
    process.env.DATABASE_URL = url;
    await assert.rejects(applySmsSchema(), /rolled back/);
    assert.equal((await client.query("SELECT to_regclass('\"NotificationJob\"') AS name")).rows[0].name, null);
    assert.equal((await client.query('SELECT count(*) FROM "_prisma_migrations"')).rows[0].count, "0");
    await client.query('DROP TABLE "NotificationDelivery"');
    await applySmsSchema(); await applySmsSchema();
    assert.equal((await client.query('SELECT count(*) FROM "_prisma_migrations"')).rows[0].count, "1");
    assert.equal((await client.query("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('SmsGatewayConfiguration','NotificationJob','NotificationJobRun','NotificationDelivery')")).rows[0].count, "4");
    await client.query('UPDATE "_prisma_migrations" SET checksum=\'wrong\'');
    await assert.rejects(applySmsSchema(), /rolled back/);
  } finally {
    process.env.DATABASE_URL = original;
    await client.end();
    await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
  }
});
