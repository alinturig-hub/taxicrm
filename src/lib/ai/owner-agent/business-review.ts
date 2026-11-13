import type { AnalyticsData } from "@/lib/analytics/explorer/model";

// Pure calculations over the same bounded, read-only evidence as the owner report.
export function businessReview(data: AnalyticsData) {
  const t = data.totals;
  const known = data.areas.filter(a => a.key !== "UNKNOWN" && a.total > 0)
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  const demand = known.reduce((sum, a) => sum + a.total, 0);
  const coverageMatches = demand === t.total - t.unknownArea;
  let cumulative = 0;
  const rows = known.map(a => {
    cumulative += a.total;
    return { key: a.key, name: a.name.slice(0, 100), bookings: a.total,
      share: demand ? a.total / demand * 100 : 0,
      cumulativeBookings: cumulative, cumulativeShare: demand ? cumulative / demand * 100 : 0 };
  });
  const targetCount = demand ? rows.findIndex(r => r.cumulativeBookings >= demand * .8) + 1 : 0;
  const topCount = Math.ceil(rows.length * .2);
  const topShare = rows.slice(0, topCount).reduce((sum, r) => sum + r.share, 0);
  type Finding = { category: "Strength" | "Weakness" | "Opportunity" | "Threat"; title: string; evidence: string; status: "Observed" | "Hypothesis" };
  const findings: Finding[] = [];
  const actions: { title: string; reason: string; measure: string; owner: string; due: string }[] = [];
  if (t.total) {
    findings.push({ category: "Strength", title: "Recorded service delivery", evidence: `${t.completed} of ${t.total} selected bookings are currently completed (${(t.completed / t.total * 100).toFixed(1)}%). This is a baseline, not an industry benchmark.`, status: "Observed" });
    if (t.noFare || t.cancelled || t.rejected) {
      findings.push({ category: "Weakness", title: "Unfulfilled booking outcomes", evidence: `${t.cancelled} cancelled, ${t.noFare} no-fare and ${t.rejected} rejected bookings. Reasons and responsibility require investigation.`, status: "Observed" });
      actions.push({ title: "Review unfulfilled outcomes", reason: "Recorded outcomes indicate bookings needing investigation; recoverable demand is not yet known.", measure: "Track each outcome rate against the same pickup-period definition.", owner: "Unassigned", due: "Not scheduled" });
    }
    if (t.margin !== null && t.margin < 0) {
      findings.push({ category: "Weakness", title: "Negative recorded company margin", evidence: `Completed Price minus Cost is £${t.margin.toFixed(2)}. Discounts, loyalty funding and adjustments need reconciliation; this is not net profit.`, status: "Observed" });
      actions.unshift({ title: "Reconcile negative margin", reason: "Review source Price, Cost, loyalty and discount evidence before changing financial rules.", measure: "Reconciled negative-margin bookings and unresolved amounts.", owner: "Unassigned", due: "Not scheduled" });
    }
    if (demand && coverageMatches) {
      findings.push({ category: "Opportunity", title: "Focus the operating review", evidence: `${targetCount} of ${rows.length} known pickup zones account for at least 80% of known-zone demand. Test capacity changes before assuming a benefit.`, status: "Hypothesis" });
      findings.push({ category: "Threat", title: "Concentration exposure to validate", evidence: `The top ${topCount} zones (${(topCount / rows.length * 100).toFixed(1)}% of known zones) contribute ${topShare.toFixed(1)}% of known-zone bookings. Exposure to disruption is a hypothesis, not a forecast.`, status: "Hypothesis" });
      actions.push({ title: "Review capacity in leading demand zones", reason: "Use demand concentration alongside staffing and time-of-day evidence.", measure: "Compare completion and outcome rates before and after an approved trial.", owner: "Unassigned", due: "Not scheduled" });
    }
  }
  if (t.missingPrice || t.missingCost || t.unknownArea || !coverageMatches) actions.unshift({ title: "Resolve evidence gaps", reason: `${t.missingPrice} completed jobs missing Price; ${t.missingCost} missing Cost; ${t.unknownArea} bookings without a verified zone.${!coverageMatches ? " Area totals do not reconcile; Pareto withheld." : ""}`, measure: "Missing-field counts and reconciled zone coverage for the selected period.", owner: "Unassigned", due: "Not scheduled" });
  return { generatedAt: data.generatedAt, range: data.range,
    pareto: { available: demand > 0 && coverageMatches, dimension: "Known pickup-zone booking demand", totalBookings: demand, excludedUnknown: t.unknownArea, zones: rows.length, targetCount, targetZoneShare: rows.length ? targetCount / rows.length * 100 : null, topCount, topShare: demand ? topShare : null, rows: coverageMatches ? rows.slice(0, 10) : [] },
    findings, actions: actions.slice(0, 3),
    limitations: ["Zone demand concentration is not customer, account or driver profitability. Those dimensions need separate verified aggregates.", "SWOT is a provisional evidence review. Competitors, market threats and causal explanations require owner input.", "Actions are proposals only; no assignment, scheduling or operational changes have been executed.", "Price is gross receipts; Cost is driver money; COMPLETED Price − Cost is margin before expenses. Missing values are not zero."] };
}
