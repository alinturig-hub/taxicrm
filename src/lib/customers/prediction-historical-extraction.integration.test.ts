import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Client, type QueryResult } from "pg";

test("read-only SQL and standalone pilot run against isolated synthetic PostgreSQL", {
  skip: !process.env.PREDICTION_EXTRACTION_QA_URL,
}, async () => {
  const url = new URL(process.env.PREDICTION_EXTRACTION_QA_URL!);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.username, "qa_prediction");
  assert.equal(url.pathname, "/postgres");
  const owner = new Client({ connectionString: url.toString() });
  await owner.connect();
  const readonlyUrl = new URL(url);
  readonlyUrl.username = "cabby_ro";
  readonlyUrl.password = "synthetic_read_only";
  const reader = new Client({ connectionString: readonlyUrl.toString() });
  const ids = ["individual", "dormant", "shared", "unknown", "sparse", "late", "new-identity"].map((name) => `synthetic-pilot-${name}`);
  try {
    await owner.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cabby_ro') THEN CREATE ROLE cabby_ro LOGIN PASSWORD 'synthetic_read_only'; END IF; END $$");
    await owner.query('GRANT USAGE ON SCHEMA public TO cabby_ro; GRANT SELECT ON ALL TABLES IN SCHEMA public TO cabby_ro');
    for (const id of ids) {
      await owner.query('INSERT INTO "NormalCustomer" (id,"normalizedTelephone","telephoneNumber","createdAt","updatedAt") VALUES ($1,$1,$1,$2,$2)', [id, id.endsWith("new-identity") ? "2026-11-01" : "2026-09-01"]);
      const count = id.endsWith("shared") ? 20 : id.endsWith("sparse") ? 4 : 6;
      for (let index = 0; index < count; index++) {
        const day = id.endsWith("dormant") ? `2026-09-${String(index + 1).padStart(2, "0")}` : id.endsWith("shared") ? `2026-10-${String(index + 1).padStart(2, "0")}` : `2026-10-${20 + index}`;
        const at = `${day}T08:00:00Z`;
        const created = id.endsWith("late") ? "2026-11-01T08:00:00Z" : at;
        const bookingId = `${id}-${index}`;
        await owner.query('INSERT INTO "Booking" (id,provider,"externalId",status,"normalCustomerId","bookedAtTime","createdAt","updatedAt","rawPayload") VALUES ($1,\'SYNTHETIC\',$1,\'COMPLETED\',$2,$3,$4,$4,\'{}\')', [bookingId, id, at, created]);
        if (!id.endsWith("unknown")) {
          await owner.query('INSERT INTO "BookingLocation" (id,"bookingId",type,address,"createdAt","updatedAt") VALUES ($1,$2,\'PICKUP\',$3,$4,$4),($5,$2,\'DESTINATION\',$6,$4,$4)', [`${bookingId}-p`, bookingId, id.endsWith("shared") ? "PRIVATE shared pickup" : `PRIVATE home ${index % 2}`, created, `${bookingId}-d`, id.endsWith("shared") ? `PRIVATE destination ${index}` : "PRIVATE work"]);
        }
      }
    }
    for (const [suffix, booked, created] of [
      ["future-a", "2026-10-27T12:00:00Z", "2026-10-27T12:00:00Z"],
      ["future-b", "2026-10-31T12:00:00Z", "2026-10-31T12:00:00Z"],
      ["late-import", "2026-10-22T12:00:00Z", "2026-11-01T12:00:00Z"],
    ]) {
      await owner.query('INSERT INTO "Booking" (id,provider,"externalId",status,"normalCustomerId","bookedAtTime","createdAt","updatedAt","rawPayload") VALUES ($1,\'SYNTHETIC\',$1,\'CREATED\',\'synthetic-pilot-individual\',$2,$3,$3,\'{}\')', [`synthetic-pilot-${suffix}`, booked, created]);
    }
    await reader.connect();
    const results = await reader.query(readFileSync("scripts/prediction-historical-sample.sql", "utf8")) as unknown as QueryResult[];
    const json = results.find((result) => result.rows.length > 0)!.rows[0];
    const envelope = Object.values(json)[0] as Record<string, unknown>;
    assert.equal(envelope.sourceRole, "cabby_ro");
    assert.equal(envelope.readOnly, "on");
    assert.equal(envelope.sourceRows, 41);
    const serialized = JSON.stringify(envelope);
    assert.equal(serialized.includes("PRIVATE"), false);
    assert.equal(serialized.includes("synthetic-pilot-"), false);
    // The source is deliberately synthetic; do not label this test a real-data result.
    envelope.dataKind = "SYNTHETIC";
    const processResult = spawnSync(process.execPath, ["--max-old-space-size=256", "docs/prediction-validation/release/historical-evaluator.cjs"], { input: JSON.stringify(envelope), encoding: "utf8", timeout: 60_000, maxBuffer: 1_000_000 });
    assert.equal(processResult.status, 0, processResult.stderr);
    const report = JSON.parse(processResult.stdout);
    assert.equal(report.dataKind, "SYNTHETIC");
    assert.equal(report.cohort.selectedProfiles, 4);
    assert.equal(report.cohort.evaluatedProfiles, 2);
    assert.equal(report.cohort.sharedProfiles, 1);
    assert.equal(report.cohort.profilesWithoutIdentityEvidence, 1);
    assert.equal(report.cohort.lateImportedActionsInEvaluatedProfiles, 1);
    assert.equal(report.horizons[2].samples, 28);
    assert.ok(report.horizons.every((item: { outsideHorizon: number }) => item.outsideHorizon === 0));
    const bad = spawnSync(process.execPath, ["docs/prediction-validation/release/historical-evaluator.cjs"], { input: "not-json", encoding: "utf8", timeout: 10_000 });
    assert.equal(bad.status, 1);
    assert.equal(bad.stdout, "");
    assert.match(bad.stderr, /^HISTORICAL_PILOT_FAILED:/);
  } finally {
    await reader.end();
    await owner.query('DELETE FROM "Booking" WHERE provider=\'SYNTHETIC\' AND id LIKE \'synthetic-pilot-%\'');
    await owner.query('DELETE FROM "NormalCustomer" WHERE id = ANY($1::text[])', [ids]);
    await owner.end();
  }
});
