import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAnalytics } from "@/lib/analytics/explorer/query";
import { parseRange } from "@/lib/analytics/explorer/model";
assert.equal(
  process.env.DATABASE_URL,
  "postgresql://analytics_test@127.0.0.1:55438/analytics_synthetic",
);
test("100,000 synthetic bookings return bounded aggregates without client-side booking export", async () => {
  const provider = "SYNTHETIC_VOLUME_" + randomUUID();
  try {
    const identity = await prisma.$queryRaw<
      { db: string; role: string }[]
    >`SELECT current_database() db,current_user role`;
    assert.deepEqual(identity, [
      { db: "analytics_synthetic", role: "analytics_test" },
    ]);
    await prisma.$executeRaw`INSERT INTO public."Booking"(id,provider,"externalId",status,price,cost,"paymentType","pickupDueTime","bookedAtTime","rawPayload","updatedAt") SELECT ${provider}||g::text,${provider},g::text,'COMPLETED',10,8,'Cash',timestamp '2057-01-01 12:00'+(g%31)*interval '1 day',timestamp '2057-01-01 04:00'+(g%31)*interval '1 day','{"synthetic":true}'::jsonb,now() FROM generate_series(1,100000)g`;
    const start = performance.now();
    const r = await getAnalytics(
      parseRange(
        new URLSearchParams({
          preset: "custom",
          from: "2057-01-01",
          to: "2057-01-31",
        }),
      ),
      true,
    );
    assert.equal(r.totals.total, 100000);
    assert.equal(r.totals.gross, 1000000);
    assert.equal(r.totals.margin, 200000);
    assert.equal(r.areas.length, 1);
    assert.equal(r.hours.length, 24);
    assert.equal(r.days.length, 31);
    assert.ok(JSON.stringify(r).length < 100000);
    assert.equal(r.totals.unknownArea, 100000);
    console.log(
      "Synthetic 100k aggregate milliseconds:",
      Math.round(performance.now() - start),
    );
  } finally {
    await prisma.booking.deleteMany({ where: { provider } });
    await prisma.$disconnect();
  }
});
