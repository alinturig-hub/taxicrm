import {readFile} from "node:fs/promises";
import {createHash, randomUUID} from "node:crypto";
import pg from "pg";

// Explicitly approved, additive SMS migration only. Never runs other migrations.
export async function applySmsSchema() {
  const name = "20261011190000_sms_notifications";
  const sql = await readFile(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  const client = new pg.Client({connectionString: process.env.DATABASE_URL, options: "-c statement_timeout=30000 -c lock_timeout=5000"});
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [name]);
    const applied = await client.query('SELECT checksum, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1 AND rolled_back_at IS NULL', [name]);
    if (applied.rows.length) {
      if (applied.rows.length !== 1 || !applied.rows[0].finished_at || applied.rows[0].checksum !== checksum) throw new Error("SMS migration history requires review");
    } else {
      await client.query(sql);
      await client.query('INSERT INTO "_prisma_migrations" (id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES ($1,$2,NOW(),$3,NOW(),1)', [randomUUID(), checksum, name]);
    }
    // Optional encrypted bootstrap, using the runtime integration encryption key.
    // Gateway stays disabled; no recipient, job or SMS is created here.
    if (process.env.ORION_SMS_BOOTSTRAP_ENCRYPTED) await client.query('INSERT INTO "SmsGatewayConfiguration" (id,endpoint,"signedParametersEncrypted","updatedAt") VALUES ($1,$2,$3,NOW()) ON CONFLICT (id) DO NOTHING', ["default", "https://orionconnect.co.uk/api/endpoint/webhook", process.env.ORION_SMS_BOOTSTRAP_ENCRYPTED]);
    await client.query("COMMIT");
    console.log("Approved SMS schema verified; gateway bootstrap remains disabled.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error("Approved SMS schema bootstrap failed; database changes rolled back.");
  } finally {await client.end();}
}
