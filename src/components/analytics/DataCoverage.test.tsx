import React from "react";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import DataCoverage from "./DataCoverage";
import type { AnalyticsData } from "@/lib/analytics/explorer/model";
function render(total: number, completed: number, extra = {}) {
  const data = {
    range: { from: "2026-10-22T00:00:00Z", to: "2026-10-22T06:00:00Z", payment: "ALL" },
    totals: { total, completed, missingPrice: 0, missingCost: 0, unknownArea: 0, other: 0, margin: 0, ...extra },
  } as AnalyticsData;
  return renderToStaticMarkup(<DataCoverage data={data} />);
}
test("coverage shows actual numerators and cohort instead of implying the entire history", () => {
  const html = render(120, 100);
  assert.match(html, /120 bookings/);
  assert.match(html, /100.*of.*100.*completed bookings/);
  assert.match(html, /not the entire booking history/);
  assert.match(html, /100% means the field is present/);
  assert.match(html, /Europe\/London/);
});
test("empty and no-completion cohorts never show a successful financial coverage percentage", () => {
  assert.doesNotMatch(render(0, 0), /100\.0%/);
  assert.match(render(0, 0), /No bookings match these filters/);
  assert.match(render(5, 0), /No completed bookings/);
});
test("missing source data remains explicit with signed margin warning", () => {
  const html = render(10, 8, { missingPrice: 2, missingCost: 1, unknownArea: 3, other: 2, margin: -1.9 });
  assert.match(html, /75\.0%/);
  assert.match(html, /2.*completed bookings have no Price/);
  assert.match(html, /discounts and loyalty funding/);
});
