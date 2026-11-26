import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { prisma } from "../../src/lib/prisma";

async function main() {
  assert.equal(process.env.TAXICRM_SYNTHETIC_TESTS, "1");
  assert.equal(process.env.DATABASE_URL, "postgresql://taxicrm@127.0.0.1:5432/taxicrm");
  const jobKeys = ["CUSTOMER_PROFILE_SNAPSHOTS", "BOOKING_DEMAND_FORECAST", "CUSTOMER_BOOKING_PREDICTIONS", "HISTORICAL_GEOAPIFY_BACKFILL"];
  const user = await prisma.user.create({
    data: { email: "automation-fixture@example.test", name: "Synthetic Automation Admin", passwordHash: "synthetic-only", role: "ADMIN" },
  });
  try {
    await prisma.automationRule.createMany({
      data: jobKeys.map((key) => ({
        key, name: key, jobKey: key, description: "Synthetic rule",
        expectedIntervalMin: 15, defaultBatchSize: 50, configuration: {},
      })),
    });
    const start = new Date("2026-11-25T00:00:00Z");
    await prisma.customerIntelligenceJobRun.createMany({
      data: [
        { jobKey: jobKeys[0], startedAt: start, status: "SUCCEEDED", processed: 7 },
        ...Array.from({ length: 101 }, (_, index) => ({
          jobKey: jobKeys[1], startedAt: new Date(start.getTime() + (index + 1) * 1000), status: "SUCCEEDED", processed: index,
        })),
      ],
    });
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { email: user.email, sub: user.id, role: user.role } });
    const url = "http://127.0.0.1:3001/api/dashboard/ai/automation";
    const headers = { cookie: `next-auth.session-token=${token}` };
    assert.equal((await fetch(url)).status, 403);

    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    const result = await response.json();
    const byJob = Object.fromEntries(result.rules.map((rule: { jobKey: string }) => [rule.jobKey, rule]));
    assert.deepEqual(jobKeys.map((key) => byJob[key].scheduler.intervalMinutes), [360, 720, 360, 360]);
    assert.deepEqual(jobKeys.map((key) => byJob[key].scheduler.configured), [true, true, true, false]);
    assert.equal(byJob.CUSTOMER_PROFILE_SNAPSHOTS.status, "DISABLED");
    assert.equal(byJob.CUSTOMER_PROFILE_SNAPSHOTS.latestJobRun.processed, 7);
    assert.equal(byJob.BOOKING_DEMAND_FORECAST.latestJobRun.processed, 100);
    assert.equal(byJob.HISTORICAL_GEOAPIFY_BACKFILL.latestJobRun, null);
    assert.equal(result.safeguards.directExecutionEnabled, false);

    const simulation = await fetch(`${url}/${byJob.CUSTOMER_PROFILE_SNAPSHOTS.id}/simulate`, { method: "POST", headers });
    assert.equal(simulation.status, 200);
    const execution = await prisma.automationExecution.findFirstOrThrow({
      where: { ruleId: byJob.CUSTOMER_PROFILE_SNAPSHOTS.id },
    });
    assert.equal(execution.mode, "SIMULATION");
    assert.equal(execution.processed, 0);
    assert.equal(await prisma.customerIntelligenceJobRun.count({ where: { jobKey: { in: jobKeys } } }), 102);
    console.log("PASS: Automation runtime cadence, independent job history and audited simulation.");
  } finally {
    await prisma.automationRule.deleteMany({ where: { jobKey: { in: jobKeys } } });
    await prisma.customerIntelligenceJobRun.deleteMany({ where: { jobKey: { in: jobKeys } } });
    await prisma.administrationAuditEvent.deleteMany({ where: { actorUserId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
