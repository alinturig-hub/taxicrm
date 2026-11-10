import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBookingFrequencyReference as reference } from "./booking-frequency-reference";
const now = new Date("2026-11-10T12:00:00Z");
const options = { now, historyAvailableFrom: new Date("2026-01-01T00:00:00Z"), profileSafeForPersonalisation: true };
const rows = Array.from({ length: 5 }, (_, index) => {
  const at = new Date(now.getTime() - (index + 1) * 86_400_000);
  return { bookedAtTime: at, availableAt: at };
});
test("matches the diagnostic's unchanged frequency comparator at every horizon", () => {
  const result = reference(rows, options);
  assert.equal(result.status, "READY"); assert.equal(result.recent28, 5);
  for (const horizon of result.horizons) assert.equal(horizon.rankingScore, 100 * (1 - Math.exp(-5 * horizon.hours / (28 * 24))));
  assert.equal(result.recencyHours, 24);
  assert.equal(result.recent7, 5);
});
test("future actions and late imports cannot alter an earlier score", () => {
  const expected = reference(rows, options);
  const extra = [
    { bookedAtTime: "2026-11-11T12:00:00Z", availableAt: "2026-11-09T12:00:00Z" },
    { bookedAtTime: "2026-11-08T13:00:00Z", availableAt: "2026-11-11T12:00:00Z" },
  ];
  assert.deepEqual(reference([...rows, ...extra], options).horizons, expected.horizons);
});
test("duplicates use first availability without increasing frequency", () => {
  const result = reference([...rows, { ...rows[0], availableAt: new Date("2026-11-12T00:00:00Z") }], options);
  assert.equal(result.knownActionCount, 5); assert.equal(result.duplicateTimestamps, 1);
  assert.deepEqual(result.horizons, reference(rows, options).horizons);
});
test("the rolling start is exclusive, now is inclusive, and dormant evidence is retained", () => {
  const at = new Date(now.getTime() - 28 * 86_400_000);
  const old = rows.map((_, index) => ({ bookedAtTime: new Date(at.getTime() - index * 86_400_000), availableAt: new Date(at.getTime() - index * 86_400_000) }));
  const result = reference(old, options);
  assert.equal(result.status, "READY"); assert.equal(result.recent28, 0);
  assert.ok(result.horizons.every((item) => item.rankingScore === 0));
  assert.equal(reference([...old, { bookedAtTime: now, availableAt: now }], options).recent28, 1);
});
test("unknown availability is reported, and sparse/shared profiles receive no ranking", () => {
  const result = reference([...rows.slice(0, 4), { bookedAtTime: now, availableAt: null }], options);
  assert.equal(result.status, "LEARNING"); assert.equal(result.unknownAvailabilityRows, 1); assert.deepEqual(result.horizons, []);
  assert.equal(reference(rows, { ...options, profileSafeForPersonalisation: false }).status, "DISABLED");
});
test("uses partial verified coverage and rejects invalid or empty observation intervals", () => {
  const result = reference(rows, { ...options, historyAvailableFrom: new Date(now.getTime() - 10 * 86_400_000) });
  assert.equal(result.exposureHours, 240);
  assert.equal(result.horizons[2].rankingScore, 100 * (1 - Math.exp(-5 * 24 / 240)));
  assert.throws(() => reference(rows, { ...options, historyAvailableFrom: now }), /coverage/);
});
test("ambiguous local timestamp strings are excluded and reported", () => {
  const result = reference([...rows, { bookedAtTime: "2026-11-10T08:00:00", availableAt: "2026-11-10T08:00:00Z" }], options);
  assert.equal(result.invalidRows, 1);
  assert.deepEqual(result.horizons, reference(rows, options).horizons);
});
