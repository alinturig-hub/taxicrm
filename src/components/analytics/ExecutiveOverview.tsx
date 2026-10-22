"use client";
import { useState } from "react";
import DataCoverage from "./DataCoverage";
import { percentage, changePercent, type AnalyticsData } from "@/lib/analytics/explorer/model";
const count = (n: number) => n.toLocaleString("en-GB");
const pct = (n: number | null) => n === null ? "No denominator" : `${n.toFixed(1)}%`;
const money = (n: number | null) => n === null ? "Incomplete data" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const date = (s: string) => new Date(s).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
function delta(current: number, previous: number) {
  const value = changePercent(current, previous);
  return value === null ? (current ? "New activity · previous period was zero" : "No activity in either period") : `${value > 0 ? "+" : ""}${value.toFixed(1)}% vs previous period`;
}
export default function ExecutiveOverview({ data }: { data: AnalyticsData }) {
  const [sort, setSort] = useState<"total" | "noFare" | "cancelled" | "margin">("total");
  const t = data.totals, p = data.comparison;
  const areas = data.areas.filter(a => a.key !== "UNKNOWN" && (sort !== "margin" || a.completed > 0)).sort((a, b) => {
    if (a[sort] === null && b[sort] === null) return a.name.localeCompare(b.name);
    if (a[sort] === null) return 1;
    if (b[sort] === null) return -1;
    return Number(b[sort]) - Number(a[sort]) || a.name.localeCompare(b.name);
  }).slice(0, 10);
  return <div className="space-y-6">
    <section aria-label="Executive overview" className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Executive overview</p><h2 className="mt-2 text-xl font-semibold">From activity to decisions</h2></div><span className="rounded-full border border-app-border bg-surface px-3 py-1 text-xs">Recorded facts · no forecasts</span></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { name: "Booking volume", value: count(t.total), note: p ? delta(t.total, p.total) : "Comparison unavailable" },
          { name: "Completion share", value: pct(percentage(t.completed, t.total)), note: "Current COMPLETED / all selected bookings; ongoing jobs remain in the denominator." },
          { name: "Unfulfilled outcomes", value: count(t.cancelled + t.noFare + t.rejected), note: "Current cancelled + no fare + rejected. No monetary loss is inferred." },
          { name: "Recorded gross income", value: money(t.gross), note: t.missingPrice || p?.missingPrice ? "Partial coverage · financial comparison withheld" : p ? delta(t.gross, p.gross) : "COMPLETED bookings only" },
        ].map(item => <div key={item.name} className="min-w-0 rounded-xl border border-app-border bg-surface p-4"><h3 className="text-xs text-app-muted">{item.name}</h3><p className="mt-2 text-2xl font-semibold">{item.value}</p><p className="mt-2 text-xs leading-5 text-app-muted">{item.note}</p></div>)}
      </div>
      {p && <details className="mt-4 text-xs text-app-muted"><summary className="cursor-pointer">Comparison methodology</summary><p className="mt-2 leading-5">Previous pickup window: {date(p.from)} — {date(p.to)} (end exclusive), Europe/London. Same payment filter, equal elapsed duration, immediately before the selected window. This is not a matched weekday comparison; local hours may differ across daylight saving changes. Outcomes reflect the current status, not the status at the historical cutoff.</p></details>}
    </section>
    <DataCoverage data={data} />
    <section aria-label="Area performance scorecard" className="rounded-2xl border border-app-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Area performance scorecard</h2><p className="mt-1 text-xs text-app-muted">Top 10 known pickup zones · compare volumes and rates together. Small samples can produce extreme rates.</p></div><label className="text-xs text-app-muted">Rank by<select aria-label="Rank areas by" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="ml-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-app-primary"><option value="total">Bookings</option><option value="noFare">No fare volume</option><option value="cancelled">Cancellation volume</option><option value="margin">Recorded margin</option></select></label></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="border-b border-app-border text-xs text-app-muted"><tr>{["Pickup zone", "Bookings", "Completed", "No fare", "Cancelled", "Price − Cost"].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{areas.map(a => <tr key={a.key} className="border-b border-app-border last:border-0"><th scope="row" className="px-3 py-3 font-medium">{a.name}</th><td className="px-3 py-3">{count(a.total)}</td><td className="px-3 py-3">{pct(percentage(a.completed, a.total))}</td><td className="px-3 py-3">{count(a.noFare)} · {pct(percentage(a.noFare, a.total))}</td><td className="px-3 py-3">{count(a.cancelled)} · {pct(percentage(a.cancelled, a.total))}</td><td className="px-3 py-3">{a.completed ? money(a.margin) : "No completed jobs"}</td></tr>)}</tbody></table></div>
      {!areas.length && <p className="mt-3 text-sm text-app-muted">No known pickup zones in this selection.</p>}
      <p className="mt-3 text-xs text-app-muted">Margin excludes rent, commissions and other business expenses. It is not net profit.</p>
    </section>
  </div>;
}
