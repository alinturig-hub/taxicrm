import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";
import { readFileSync } from "node:fs";

test("reviewed nullable migration preserves legacy rows and privileges and rejects the read-only role", { skip: !process.env.FREQUENCY_MIGRATION_QA_URL }, async () => {
  const url = new URL(process.env.FREQUENCY_MIGRATION_QA_URL!);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.pathname, "/postgres"); assert.equal(url.username, "qa_prediction");
  const owner = new Client({ connectionString: url.toString() }); await owner.connect();
  const roUrl = new URL(url); roUrl.username = "cabby_ro"; roUrl.password = "synthetic_read_only";
  const reader = new Client({ connectionString: roUrl.toString() });
  try {
    await owner.query('ALTER TABLE "CustomerBookingPrediction" ALTER COLUMN "observedRate" SET NOT NULL');
    await owner.query('INSERT INTO "NormalCustomer" (id,"normalizedTelephone","telephoneNumber","updatedAt") VALUES (\'synthetic-migration\',\'+447700900061\',\'+447700900061\',now())');
    await owner.query(`INSERT INTO "CustomerBookingPrediction" (id,"normalCustomerId","modelVersion","issuedAt","windowStartAt","windowEndAt",score,level,"observedRate","evidenceConfidence","calibrationSamples","inputFingerprint","updatedAt") VALUES ('synthetic-legacy-rate','synthetic-migration','HAZARD_SLOT_V1',now(),now(),now()+interval '24 hours',40,'ELEVATED',57.57,60,2015,'synthetic-rate',now())`);
    const before = (await owner.query('SELECT id,"modelVersion","observedRate"::text FROM "CustomerBookingPrediction" ORDER BY id')).rows;
    const acl = (await owner.query(`SELECT relacl::text FROM pg_class WHERE oid='public."CustomerBookingPrediction"'::regclass`)).rows;
    const sql = readFileSync("docs/prediction-reference/install-nullable-benchmark.sql", "utf8");
    await owner.query(sql);
    assert.deepEqual((await owner.query('SELECT id,"modelVersion","observedRate"::text FROM "CustomerBookingPrediction" ORDER BY id')).rows, before);
    assert.deepEqual((await owner.query(`SELECT relacl::text FROM pg_class WHERE oid='public."CustomerBookingPrediction"'::regclass`)).rows, acl);
    await owner.query(`INSERT INTO "CustomerBookingPrediction" (id,"normalCustomerId","modelVersion","issuedAt","windowStartAt","windowEndAt",score,level,"observedRate","evidenceConfidence","calibrationSamples","inputFingerprint","updatedAt") VALUES ('synthetic-null-rate','synthetic-migration','FREQUENCY_REFERENCE_V1',now(),now(),now()+interval '24 hours',10,'LOW',NULL,0,0,'synthetic-null',now())`);
    await owner.query(sql); // idempotent, including when genuine unknown values exist
    assert.equal((await owner.query(`SELECT "observedRate" FROM "CustomerBookingPrediction" WHERE id='synthetic-null-rate'`)).rows[0].observedRate, null);
    await owner.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cabby_ro') THEN CREATE ROLE cabby_ro LOGIN PASSWORD 'synthetic_read_only'; END IF; END $$");
    await reader.connect();
    await assert.rejects(reader.query(sql), /existing prediction-table owner/);
    await reader.query("ROLLBACK");
  } finally {
    await reader.end();
    await owner.query(`DELETE FROM "NormalCustomer" WHERE id='synthetic-migration'`);
    await owner.end();
  }
});
