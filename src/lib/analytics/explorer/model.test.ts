import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseRange,
  cleanCards,
  rentEstimate,
  topArea,
  type Area,
} from "./model";
test("rolling hours are absolute elapsed time across London DST", () => {
  for (const [preset, h] of [
    ["last-hour", 1],
    ["last-6-hours", 6],
    ["last-12-hours", 12],
  ] as const) {
    const r = parseRange(
      new URLSearchParams({ preset }),
      new Date("2026-10-25T03:30Z"),
    );
    assert.equal(r.to.getTime() - r.from.getTime(), h * 3600000);
  }
});
test("custom calendar dates include the end day and preserve 23/25 hour London days", () => {
  for (const [date, hours] of [
    ["2026-03-29", 23],
    ["2026-10-25", 25],
  ] as const) {
    const r = parseRange(
      new URLSearchParams({ preset: "custom", from: date, to: date }),
    );
    assert.equal(r.to.getTime() - r.from.getTime(), hours * 3600000);
    assert.equal(r.calendarDays, 1);
  }
  const r = parseRange(
    new URLSearchParams({
      preset: "custom",
      from: "2026-10-19",
      to: "2026-10-25",
    }),
  );
  assert.equal(r.calendarDays, 7);
});
test("today and Monday week-to-date use London boundaries", () => {
  const now = new Date("2026-07-15T12:00Z");
  assert.equal(
    parseRange(new URLSearchParams(), now).from.toISOString(),
    "2026-07-14T23:00:00.000Z",
  );
  assert.equal(
    parseRange(
      new URLSearchParams({ preset: "this-week" }),
      now,
    ).from.toISOString(),
    "2026-07-12T23:00:00.000Z",
  );
});
test("invalid filters, reversed or oversized ranges and impossible dates fail closed", () => {
  for (const p of [
    { preset: "bad" },
    { payment: "DROP" },
    { preset: "custom", from: "2026-02-30", to: "2026-03-01" },
    { preset: "custom", from: "2026-04-02", to: "2026-04-01" },
    { preset: "custom", from: "2020-01-01", to: "2026-01-01" },
  ])
    assert.throws(() =>
      parseRange(
        new URLSearchParams(
          Object.entries(p).map(([key, value]) => [key, String(value)]),
        ),
      ),
    );
});
test("card preferences reject unknown keys, duplicates and unsafe property names", () =>
  assert.deepEqual(
    cleanCards(["total", "total", "__proto__", "gross", "constructor"]),
    ["total", "gross"],
  ));
test("rent is configured, capped per London week and never counted twice as a driver", () => {
  const rows = [
    { driver: "synthetic", week: "2026-01-05", earnings: 900, missing: 0 },
    { driver: "synthetic", week: "2026-01-12", earnings: 900, missing: 0 },
  ];
  assert.deepEqual(rentEstimate(rows, 20, 160), {
    estimated: 320,
    fullRentDrivers: 1,
    fullRentDriverWeeks: 2,
    rate: 20,
    cap: 160,
    missingCosts: 0,
  });
  assert.equal(rentEstimate(rows, null, null).estimated, null);
  assert.equal(
    rentEstimate([{ ...rows[0], missing: 1 }], 20, 160).estimated,
    null,
  );
});
test("area profitability retains negative margins, excludes unknown/incomplete/no-completion zones", () => {
  const areas = [
    { key: "UNKNOWN", name: "Unknown", margin: 500, completed: 1 },
    { key: "a", name: "A", margin: -1.9, completed: 1 },
    { key: "b", name: "B", margin: -10, completed: 1 },
    { key: "c", name: "C", margin: null, completed: 1 },
    { key: "d", name: "D", margin: 0, completed: 0 },
  ] as Area[];
  assert.equal(topArea(areas, "margin")?.name, "A");
});
