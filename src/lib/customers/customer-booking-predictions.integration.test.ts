import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOOKING_PREDICTION_MODEL_VERSION as CURRENT,
  PREVIOUS_BOOKING_PREDICTION_MODEL_VERSION as LEGACY,
} from "./booking-prediction-model";

// Opt-in only. Refuse every target except the dedicated local synthetic database
// before importing the application client, which reads DATABASE_URL at import.
test("model versions remain isolated in PostgreSQL and legacy evidence is preserved", {
  skip: !process.env.PREDICTION_QA_DATABASE_URL,
}, async (t) => {
  const url = new URL(process.env.PREDICTION_QA_DATABASE_URL!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.pathname, "/prediction_qa");
  assert.equal(url.username, "qa_prediction");
  process.env.DATABASE_URL = url.toString();
  const { prisma } = await import("../prisma");
  const { refreshCustomerBookingPrediction, getCustomerPredictionHistory, evaluateExpiredBookingPredictions } = await import("./customer-booking-predictions");
  const now = new Date();
  const day = 86_400_000;
  const customerId = "synthetic-version-customer";
  const expiredCustomerId = "synthetic-expired-customer";
  const prior = (id: string, modelVersion: string, status = "PENDING", owner = customerId) => ({
    id, normalCustomerId: owner, modelVersion, horizonHours: 24,
    issuedAt: new Date(now.getTime() - (status === "PENDING" ? 3_600_000 : 2 * day)),
    windowStartAt: new Date(now.getTime() - (status === "PENDING" ? 3_600_000 : 2 * day)),
    windowEndAt: new Date(now.getTime() + (status === "PENDING" ? 23 * 3_600_000 : -day)),
    likelyWindowStartAt: null, likelyWindowEndAt: null,
    score: 40, level: "ELEVATED", observedRate: modelVersion === CURRENT ? null : 57.57,
    evidenceConfidence: 60, calibrationSamples: 2015, status,
    inputFingerprint: id, activeKey: status === "PENDING" ? `${owner}:${modelVersion}:24` : null,
  });
  try {
    const identity = await prisma.$queryRaw<Array<{ name: string; role: string }>>`SELECT current_database() AS name, current_user AS role`;
    assert.deepEqual(identity, [{ name: "prediction_qa", role: "qa_prediction" }]);
    await prisma.normalCustomer.createMany({ data: [
      { id: customerId, normalizedTelephone: "+447700900011", telephoneNumber: "+447700900011" },
      { id: expiredCustomerId, normalizedTelephone: "+447700900012", telephoneNumber: "+447700900012" },
    ] });
    await prisma.booking.createMany({ data: Array.from({ length: 6 }, (_, index) => {
      const at = new Date(now.getTime() - (6 - index) * day);
      return { id: `synthetic-version-booking-${index}`, externalId: `SYNTHETIC-VERSION-${index}`, provider: "SYNTHETIC", normalCustomerId: customerId, status: "COMPLETED", bookedAtTime: at, createdAt: at, pickupDueTime: at, completedAt: at, rawPayload: {} };
    }) });
    await prisma.customerBookingPrediction.createMany({ data: [
      prior("synthetic-legacy-pending", LEGACY),
      prior("synthetic-legacy-hit", LEGACY, "HIT"),
      prior("synthetic-current-missed", CURRENT, "MISSED"),
    ] });
    const legacyBefore = await prisma.customerBookingPrediction.findUniqueOrThrow({ where: { id: "synthetic-legacy-pending" } });

    await t.test("creates a reference model active prediction alongside legacy model without overwriting or reusing it", async () => {
      const result = await refreshCustomerBookingPrediction(customerId, { now });
      assert.equal(result.status, "READY");
      assert.equal(result.created, true);
      assert.equal(result.prediction!.modelVersion, CURRENT);
      assert.equal(result.prediction!.observedRate, null);
      assert.equal(result.prediction!.likelyWindowStartAt, null);
      assert.notEqual(result.prediction!.id, legacyBefore.id);
      assert.equal(result.prediction!.activeKey, `${customerId}:${CURRENT}:24`);
      assert.notEqual(result.prediction!.inputFingerprint, legacyBefore.inputFingerprint);
      const legacyAfter = await prisma.customerBookingPrediction.findUniqueOrThrow({ where: { id: legacyBefore.id } });
      assert.deepEqual(legacyAfter, legacyBefore);
    });

    await t.test("repeated refresh reuses reference model and emits one issuance evidence record", async () => {
      const result = await refreshCustomerBookingPrediction(customerId, { now });
      assert.equal(result.created, false);
      const evidence = await prisma.customerPredictionEvidenceEvent.findMany({ where: { predictionId: result.prediction!.id, eventType: "PREDICTION_ISSUED" } });
      assert.equal(evidence.length, 1);
      assert.equal(await prisma.customerBookingPrediction.count({ where: { normalCustomerId: customerId, modelVersion: CURRENT, status: "PENDING" } }), 1);
    });

    await t.test("history retains both versions but legacy model hits cannot inflate reference model accuracy", async () => {
      const history = await getCustomerPredictionHistory(customerId);
      assert.equal(history.predictions.length, 4);
      assert.ok(history.predictions.some((item) => item.modelVersion === LEGACY));
      assert.ok(history.predictions.some((item) => item.modelVersion === CURRENT));
      assert.equal(history.accuracy.evaluated, 1);
      assert.equal(history.accuracy.hits, 0);
      assert.equal(history.accuracy.hitRate, 0);
      assert.ok(history.predictions.filter((item) => item.modelVersion === CURRENT).every((item) => item.observedRate === null));
    });

    await t.test("a booking can resolve each version's own pending prediction without relabelling history", async () => {
      const at = new Date(now.getTime() + 60_000);
      const booking = await prisma.booking.create({ data: { id: "synthetic-version-trigger", externalId: "SYNTHETIC-VERSION-TRIGGER", provider: "SYNTHETIC", normalCustomerId: customerId, status: "CREATED", bookedAtTime: at, pickupDueTime: at, rawPayload: {} } });
      await refreshCustomerBookingPrediction(customerId, { now: new Date(now.getTime() + 120_000), triggerBookingId: booking.id });
      const legacy = await prisma.customerBookingPrediction.findUniqueOrThrow({ where: { id: legacyBefore.id } });
      assert.equal(legacy.modelVersion, LEGACY);
      assert.equal(legacy.status, "HIT");
      assert.equal(legacy.activeKey, null);
      const evidence = await prisma.customerPredictionEvidenceEvent.count({ where: { predictionId: legacy.id, eventType: "BOOKING_MATCHED" } });
      assert.equal(evidence, 1);
      const history = await getCustomerPredictionHistory(customerId);
      assert.equal(history.accuracy.evaluated, 2);
      assert.equal(history.accuracy.hits, 1);
      assert.equal(history.accuracy.hitRate, 50);
      assert.equal(history.predictions.filter((item) => item.modelVersion === LEGACY && item.status === "HIT").length, 2);
      assert.equal(await prisma.customerPredictionEvidenceEvent.count({ where: { prediction: { modelVersion: CURRENT }, eventType: { in: ["TIME_SLOT_CONFIRMED", "TIME_SLOT_MISSED"] } } }), 0);
    });

    await t.test("scheduled expiry closes both old and new pending records under their original versions", async () => {
      await prisma.customerBookingPrediction.createMany({ data: [LEGACY, CURRENT].map((model) => ({
        ...prior(`synthetic-expired-${model}`, model, "PENDING", expiredCustomerId),
        issuedAt: new Date(now.getTime() - 2 * day), windowStartAt: new Date(now.getTime() - 2 * day), windowEndAt: new Date(now.getTime() - day),
      })) });
      const result = await evaluateExpiredBookingPredictions({ now, limit: 100 });
      assert.equal(result.missed, 2);
      const rows = await prisma.customerBookingPrediction.findMany({ where: { normalCustomerId: expiredCustomerId } });
      assert.equal(rows.length, 2);
      assert.deepEqual(rows.map((item) => item.modelVersion).sort(), [CURRENT, LEGACY].sort());
      assert.ok(rows.every((item) => item.status === "MISSED" && item.activeKey === null));
    });
  } finally {
    await prisma.booking.deleteMany({ where: { provider: "SYNTHETIC", normalCustomerId: { in: [customerId, expiredCustomerId] } } });
    await prisma.normalCustomer.deleteMany({ where: { id: { in: [customerId, expiredCustomerId] } } });
    await prisma.$disconnect();
  }
});
