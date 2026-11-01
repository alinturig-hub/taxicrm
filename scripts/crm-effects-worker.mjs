// Dedicated TaxiCRM process for CRM effects in the shared booking outbox.
const port = process.env.CRM_WORKER_PORT || process.env.PORT || "3000";
const secret = process.env.CRON_SECRET;
const pollMs = 15_000;
let stopping = false;

if (!secret) {
  console.error("CRM booking effects process needs CRON_SECRET.");
  process.exit(1);
}

async function drain() {
  let completed = 0;
  let failed = 0;
  for (let batch = 0; batch < 10 && !stopping; batch += 1) {
    const response = await fetch(`http://127.0.0.1:${port}/api/internal/crm-post-commit-worker`, {
      method: "POST",
      headers: { "x-cron-secret": secret },
      signal: AbortSignal.timeout(9 * 60_000),
    });
    if (!response.ok) throw new Error(`CRM effects endpoint returned ${response.status}.`);
    const result = await response.json();
    if (result.enabled !== true) throw new Error("CRM effects endpoint is disabled.");
    if (result.claimed === 0) break;
    completed += result.completed;
    failed += result.failed;
  }
  if (completed || failed) console.log(`CRM booking effects: ${completed} completed, ${failed} retried.`);
}

async function loop() {
  while (!stopping) {
    try {
      await drain();
    } catch (error) {
      console.error("CRM booking effects process failed:", error);
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

process.on("SIGTERM", () => { stopping = true; process.exit(0); });
process.on("SIGINT", () => { stopping = true; process.exit(0); });

await new Promise((resolve) => setTimeout(resolve, 10_000));
await loop();
