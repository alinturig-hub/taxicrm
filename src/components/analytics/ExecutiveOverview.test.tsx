import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import ExecutiveOverview from "./ExecutiveOverview";
import type { AnalyticsData, Totals } from "@/lib/analytics/explorer/model";
const totals: Totals = {
  total: 120, completed: 100, cancelled: 2, rejected: 18, noFare: 0, recovered: 0, prebook: 0,
  cash: 120, account: 0, card: 0, other: 0, missingPrice: 0, missingCost: 0, unknownArea: 0,
  gross: 1000, driverMoney: 900, margin: 100, cashIncome: 1000, accountIncome: 0, cardIncome: 0, otherIncome: 0,
};
const data = {
  totals,
  areas: [{ ...totals, key: "SYNTHETIC:1", name: "Synthetic Derriford", latitude: null, longitude: null }],
  comparison: { from: "2026-10-20T00:00:00Z", to: "2026-10-21T00:00:00Z", total: 60, completed: 50, gross: 500, missingPrice: 0, margin: 80, cancelled: 1, noFare: 0, rejected: 5, areas: [{ key: "SYNTHETIC:1", total: 60 }] },
} as AnalyticsData;
test("executive view leads with decisions, area demand changes and rejection volumes/rates", () => {
  const html = renderToStaticMarkup(<ExecutiveOverview data={data} />);
  assert.match(html, /Booking demand/);
  assert.match(html, /Company margin/);
  assert.match(html, /Unfulfilled bookings/);
  assert.match(html, /Synthetic Derriford/);
  assert.match(html, /100\.0% vs previous period/);
  assert.match(html, /Driver money/);
  assert.match(html, /does not prove a driver shortage/);
  assert.doesNotMatch(html, /Data confidence|Zone coverage/);
});
test("unknown and incomplete margins never become area profit winners or made-up differences", () => {
  const partial = { ...data, totals: { ...totals, margin: null, missingPrice: 1 }, areas: [{ ...data.areas[0], margin: null, missingPrice: 1 }] };
  const html = renderToStaticMarkup(<ExecutiveOverview data={partial} />);
  assert.match(html, /Complete amounts required/);
  assert.match(html, /Comparison requires complete Price and Cost/);
  assert.match(html, /Missing Price/);
});
test("negative margin comparisons use currency differences, not misleading percentage growth", () => {
  const negative = { ...data, totals: { ...totals, margin: -10 }, comparison: { ...data.comparison!, margin: -20 } };
  const html = renderToStaticMarkup(<ExecutiveOverview data={negative} />);
  assert.match(html, /\+£10\.00 vs previous period/);
  assert.match(html, /before rent, commissions and other expenses/);
});
