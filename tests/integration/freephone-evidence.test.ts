import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, after } from "node:test";
import { prisma } from "../../src/lib/prisma";
import { readCounts } from "../../src/lib/notifications/operations";
import { auditFreephoneNumbers } from "../../src/lib/notifications/phone-audit";
import { importFreephoneDrafts } from "../../src/lib/notifications/freephone-drafts";
if (
  process.env.TAXICRM_SYNTHETIC_TESTS !== "1" ||
  process.env.DATABASE_URL !== "postgresql://taxicrm@127.0.0.1:5432/taxicrm"
)
  throw new Error("Requires opted-in isolated database.");
after(() => prisma.$disconnect());
test("canonical payload evidence is read-only, timezone explicit, calendar valid and subordinate to mapped dates", async () => {
  const prefix = `evidence-synthetic-${randomUUID()}`;
  const phone = "07700900043";
  const now = new Date("2026-10-25T12:00:00Z");
  const entries = [
    { BookedAtTime: "2026-10-25T12:00:00.123Z" },
    { BookedAtTime: "2026-10-25T12:30:00+01:00" },
    { BookedAtTime: "2026-10-25T11:00:00" },
    { BookedAtTime: "2026-02-30T11:00:00Z" },
    { BookedAtTime: "infinity" },
    { BookedAtTime: "2026-10-25T11:00:00Z" },
  ];
  try {
    for (let i = 0; i < entries.length; i++)
      await prisma.booking.create({
        data: {
          externalId: `${prefix}-${i}`,
          telephoneNumber: i === 1 ? null : phone,
          bookedAtTime: i === 5 ? new Date("2026-10-23T11:00:00Z") : null,
          rawPayload: {
            ...entries[i],
            TelephoneNumber: "+447700900043",
            synthetic: true,
          },
        },
      });
    const before = await prisma.booking.findMany({
      where: { externalId: { startsWith: prefix } },
      orderBy: { externalId: "asc" },
    });
    const counts = await readCounts(
      { sourceField: "telephoneNumber", sourceValue: phone },
      now,
      prisma,
      12,
    );
    assert.equal(counts.count, 1);
    assert.equal(counts.known, 6);
    assert.equal(counts.payloadDateUsed, 2);
    assert.equal(counts.missingDate, 3);
    const audit = await auditFreephoneNumbers([phone, "01632960000"], now);
    const ordered = [
      phone,
      ...Array.from(
        { length: 11 },
        (_, i) => "07700900" + String(i).padStart(3, "0"),
      ),
    ];
    assert.deepEqual(
      (await auditFreephoneNumbers(ordered, now)).rows.map((r) => r.phone),
      ordered,
    );
    assert.deepEqual(
      audit.rows.map((r) => r.phone),
      [phone, "01632960000"],
    );
    assert.equal(audit.rows[0].futureDates, 1);
    assert.equal(audit.rows[0].last12h, 1);
    assert.equal(audit.rows[0].payloadDateUsed, 2);
    const after = await prisma.booking.findMany({
      where: { externalId: { startsWith: prefix } },
      orderBy: { externalId: "asc" },
    });
    assert.deepEqual(after, before);
  } finally {
    await prisma.booking.deleteMany({
      where: { externalId: { startsWith: prefix } },
    });
  }
});
test("draft provisioning is concurrent/idempotent and cannot overwrite an existing live workflow", async () => {
  const name = `draft-synthetic-${randomUUID()}`;
  const phone = "07700900044";
  try {
    const results = await Promise.all([
      importFreephoneDrafts([
        { name, phone, isEnabled: true, defaultRecipient: "+447700900000" },
      ]),
      importFreephoneDrafts([{ name, phone: "+447700900044" }]),
    ]);
    assert.equal(
      results.reduce((sum, r) => sum + r.created.length, 0),
      1,
    );
    const job = await prisma.notificationJob.findFirstOrThrow({
      where: { name },
    });
    assert.equal(job.isEnabled, false);
    assert.equal(job.defaultRecipient, "");
    assert.equal(job.sourceConfirmed, false);
    assert.equal(
      (job.rules as { enabled: boolean; windowHours: number }[])[0].enabled,
      false,
    );
    assert.equal((job.rules as { windowHours: number }[])[0].windowHours, 12);
    await prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        defaultRecipient: "+447700900000",
        sourceConfirmed: true,
        isEnabled: true,
      },
    });
    await importFreephoneDrafts([{ name: "Different name", phone }]);
    const saved = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    assert.equal(saved.name, name);
    assert.equal(saved.isEnabled, true);
    assert.equal(saved.defaultRecipient, "+447700900000");
    assert.equal(
      await prisma.notificationJobRun.count({ where: { jobId: job.id } }),
      0,
    );
  } finally {
    await prisma.notificationJob.deleteMany({ where: { name } });
  }
});
