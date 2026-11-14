import { businessReview } from "./business-review";
import { createHash } from "node:crypto";
import { topArea, type AnalyticsData } from "@/lib/analytics/explorer/model";
import { KNOWLEDGE_VERSION, knowledge, type AgentTool, type Preferences } from "./policy";
export type AgentAnswer = ReturnType<typeof answerFromEvidence>;
export function answerFromEvidence(tool: AgentTool, data: AnalyticsData, preferences: Preferences) {
  const t = data.totals;
  const metrics = {
    demand: { label: "Booking demand", value: t.total, unit: "bookings", coverage: "Selected pickup window" },
    completed: { label: "Completed", value: t.completed, unit: "bookings", coverage: "Current status" },
    gross: { label: "Recorded gross income", value: t.gross, unit: "GBP", coverage: t.missingPrice ? `${t.missingPrice} completed jobs missing Price; partial known subtotal` : "COMPLETED jobs only" },
    driver: { label: "Recorded driver money", value: t.driverMoney, unit: "GBP", coverage: t.missingCost ? `${t.missingCost} completed jobs missing Cost; partial known subtotal` : "COMPLETED jobs only" },
    margin: { label: "Company margin, before expenses", value: t.margin, unit: "GBP", coverage: t.margin === null ? "Missing Price or Cost; unknown" : "COMPLETED Price − Cost; not net profit" },
    cancelled: { label: "Cancelled", value: t.cancelled, unit: "bookings", coverage: "Current status, not attributed fault" },
    rejected: { label: "Rejected", value: t.rejected, unit: "bookings", coverage: "Current status, not attributed fault" },
    noFare: { label: "No fare", value: t.noFare, unit: "bookings", coverage: "Current status, not attributed fault" },
  };
  const groups = {
    OVERVIEW: preferences.priority === "INCREASE_MARGIN" ? [metrics.margin, metrics.gross, metrics.demand, metrics.noFare] : preferences.priority === "REDUCE_NO_FARE" ? [metrics.noFare, metrics.cancelled, metrics.demand, metrics.margin] : preferences.priority === "IMPROVE_COMPLETION" ? [metrics.completed, metrics.demand, metrics.cancelled, metrics.rejected] : [metrics.demand, metrics.completed, metrics.margin, metrics.noFare],
    DEMAND: [metrics.demand, metrics.completed], MARGIN: [metrics.gross, metrics.driver, metrics.margin],
    OUTCOMES: [metrics.cancelled, metrics.rejected, metrics.noFare], AREAS: [metrics.demand], HELP: [],
  };
  const headers = { OVERVIEW: "Your business overview", DEMAND: "Recorded booking demand", MARGIN: "Company money and driver money", OUTCOMES: "Bookings to investigate", AREAS: "Pickup areas to review", HELP: "Choose a business question" };
  const busiest = topArea(data.areas, "total"), profitable = topArea(data.areas, "margin");
  const areas = tool === "AREAS" ? [
    ...(busiest ? [{ label: "Highest booking demand", name: busiest.name.slice(0, 100), bookings: busiest.total, margin: null as number | null }] : []),
    ...(profitable ? [{ label: "Highest complete recorded margin", name: profitable.name.slice(0, 100), bookings: profitable.completed, margin: profitable.margin }] : []),
  ] : [];
  const params = new URLSearchParams({ preset: data.range.preset, payment: data.range.payment });
  // The exact as-of window is returned below; dashboard links with rolling presets are refreshed views.
  if (data.range.preset === "custom") {
    const localDay = (s: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(s));
    params.set("from", localDay(data.range.from)); params.set("to", localDay(new Date(new Date(data.range.to).getTime() - 1).toISOString()));
  }
  const evidence = { generatedAt: data.generatedAt, range: data.range, tool, metrics: groups[tool], areas, unknownAreas: t.unknownArea, businessReview: tool === "OVERVIEW" ? businessReview(data, preferences.priority) : null };
  return {
    headline: headers[tool],
    summary: t.total ? "Calculated from recorded company bookings for the selected pickup period. These are observations, not a forecast or a causal diagnosis." : "No bookings match the selected pickup period and payment filter. This does not mean the company has no historical bookings.",
    ...evidence,
    knowledgeVersion: KNOWLEDGE_VERSION,
    evidenceId: createHash("sha256").update(JSON.stringify(evidence)).digest("hex").slice(0, 24),
    rules: preferences.style === "DETAILED" ? knowledge : [knowledge[0], knowledge[1], knowledge[4]],
    sources: [{ label: "Canonical Booking aggregates · inspect Business Analytics", href: "/dashboard/analytics?" + params }],
    limitations: ["Company isolation is provided by this dedicated deployment and database binding, not a dispatch companyId filter.", "Net profit, driver fault and passenger readiness are not inferred.", ...(t.unknownArea ? [`${t.unknownArea} bookings lack a verified pickup zone and are excluded from area rankings.`] : [])],
  };
}
