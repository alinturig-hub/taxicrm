import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
// Explicit production approval: only this additive provider migration.
export async function applyWebhookProviderSchema() {
  const name = "20261012100000_webhook_providers";
  const sql = await readFile(
    new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
    "utf8",
  );
  const checksum = createHash("sha256").update(sql).digest("hex");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    options: "-c statement_timeout=30000 -c lock_timeout=5000",
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [name]);
    const before = await client.query(
      'SELECT count(*)::int AS count FROM "AutocabWebhookConfiguration"',
    );
    const applied = await client.query(
      'SELECT checksum, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL',
      [name],
    );
    if (applied.rows.length) {
      if (
        applied.rows.length !== 1 ||
        !applied.rows[0].finished_at ||
        applied.rows[0].checksum !== checksum
      )
        throw new Error("Migration history requires review");
    } else {
      await client.query(sql);
      await client.query(
        'INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,NOW(),$3,NOW(),1)',
        [randomUUID(), checksum, name],
      );
    }
    const after = await client.query(
      'SELECT count(*)::int AS count FROM "AutocabWebhookConfiguration"',
    );
    const source = await client.query(
      'SELECT id FROM "WebhookProvider" WHERE id=$1',
      ["autocab"],
    );
    if (before.rows[0].count !== after.rows[0].count || source.rowCount !== 1)
      throw new Error("Provider preservation check failed");
    await client.query("COMMIT");
    console.log(
      "Approved webhook provider schema verified; existing configurations preserved.",
    );
  } catch {
    await client.query("ROLLBACK");
    throw new Error(
      "Approved webhook provider migration failed; transaction rolled back.",
    );
  } finally {
    await client.end();
  }
}
