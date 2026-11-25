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
    await prisma.booking.create({
      data: {
        externalId: prefix + "-invalid-phone",
        rawPayload: {
          BookedAtTime: "2026-10-25T11:00:00Z",
          TelephoneNumber: ["+447700900043"],
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
    assert.equal(counts.missingSource, 1);
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

test("mapped UTC times keep the same 12-hour boundary in a Europe/London database session across DST", async () => {
  const prefix = `timezone-synthetic-${randomUUID()}`;
  const phone = "07700900047";
  const now = new Date("2026-10-25T12:00:00Z");
  try {
    await prisma.booking.create({
      data: {
        externalId: prefix + "-mapped",
        telephoneNumber: phone,
        bookedAtTime: new Date("2026-10-25T00:30:00Z"),
        rawPayload: { synthetic: true },
      },
    });
    await prisma.booking.create({
      data: {
        externalId: prefix + "-boundary",
        telephoneNumber: phone,
        bookedAtTime: new Date("2026-10-25T00:00:00Z"),
        rawPayload: { synthetic: true },
      },
    });
    await prisma.booking.create({
      data: {
        externalId: prefix + "-raw",
        telephoneNumber: phone,
        rawPayload: {
          BookedAtTime: "2026-10-25T01:30:00+01:00",
          synthetic: true,
        },
      },
    });
    const utc = await readCounts(
      { sourceField: "telephoneNumber", sourceValue: phone },
      now,
      prisma,
      12,
    );
    assert.equal(utc.count, 2);
    const london = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Europe/London'`;
      return readCounts(
        { sourceField: "telephoneNumber", sourceValue: phone },
        now,
        tx,
        12,
      );
    });
    assert.equal(london.count, 2);
    assert.equal(london.payloadDateUsed, 1);
  } finally {
    await prisma.booking.deleteMany({
      where: { externalId: { startsWith: prefix } },
    });
  }
});

test("Copilot applies the configured Freephone line and London week or returns clarification without a company total", async () => {
  const { bookingScope } = await import("../../src/lib/ai/copilot-booking-scope");
  const { freephoneBookings } = await import("../../src/lib/ai/copilot-freephone");
  const prefix = `copilot-freephone-${randomUUID()}`;
  const now = new Date("2026-07-22T08:00:00Z");
  const phone = "07700900075";
  const setup = {
    sourceField: "telephoneNumber",
    sourceValue: "+447700900075",
    sourceConfirmed: false,
    defaultRecipient: "",
    rules: [],
    nextRunAt: now,
  };

  try {
    await prisma.notificationJob.create({ data: { ...setup, name: `${prefix} Derriford Main Entrance` } });
    const question = `How many bookings from ${prefix} Derriford Freephone did we have this week?`;
    const scope = bookingScope(question);
    assert.ok(scope?.type === "freephone");
    assert.deepEqual(bookingScope("how many booking from derriford freephone we had this week"), {
      type: "freephone", line: "derriford", period: "this week",
    });
    assert.deepEqual(bookingScope(question.replace("this week", "this week excluding card bookings")), { type: "clarify" });
    assert.equal(bookingScope("How many bookings did we have this week?"), null);

    const bookings = [
      [phone, "2026-07-19T22:59:59Z"],
      ["00447700900075", "2026-07-19T23:00:00Z"],
      ["+447700900075", "2026-07-22T08:00:00Z"],
      [phone, "2026-07-22T08:00:01Z"],
      ["07700900076", "2026-07-22T07:00:00Z"],
    ];
    await prisma.booking.createMany({
      data: bookings.map(([telephoneNumber, bookedAt], index) => ({
        externalId: `${prefix}-${index}`, telephoneNumber, bookedAtTime: new Date(bookedAt),
        rawPayload: { synthetic: true },
      })),
    });

    const result = await freephoneBookings(scope.line, now);
    assert.equal(result.verified, true);
    assert.equal(result.answer.metrics[0]?.value, 2);
    assert.match(result.answer.headline, /Derriford Main Entrance/);
    assert.match(result.answer.summary, /20 Jul 2026, 00:00.*22 Jul 2026, 09:00/);

    const missing = await freephoneBookings(`${prefix} Unknown`, now);
    assert.equal(missing.verified, false);
    assert.deepEqual(missing.answer.metrics, []);

    await prisma.notificationJob.create({ data: { ...setup, name: `${prefix} Derriford Ward` } });
    const ambiguous = await freephoneBookings(scope.line, now);
    assert.equal(ambiguous.verified, false);
    assert.deepEqual(ambiguous.answer.metrics, []);
    assert.match(ambiguous.answer.summary, /Main Entrance.*Ward/);
  } finally {
    await prisma.booking.deleteMany({ where: { externalId: { startsWith: prefix } } });
    await prisma.notificationJob.deleteMany({ where: { name: { startsWith: prefix } } });
  }
});
