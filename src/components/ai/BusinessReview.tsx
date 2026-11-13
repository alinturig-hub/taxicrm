import React from "react";
import type { businessReview } from "@/lib/ai/owner-agent/business-review";
type Review = ReturnType<typeof businessReview>;
export default function BusinessReview({ review }: { review: Review }) {
  const p = review.pareto;
  return <section aria-label="Business Review" className="mt-5 space-y-5">
    <h3 className="text-lg font-semibold">Business Review</h3>
    <a href="/dashboard/analytics/contribution" className="inline-block text-sm text-brand">Review customer &amp; account contribution →</a>
    <div className="rounded-xl border border-app-border p-4"><h4 className="font-semibold">What drives demand? · Pareto</h4>
      <p className="mt-2 text-sm text-app-muted">{p.available ? `${p.targetCount} of ${p.zones} known pickup zones (${p.targetZoneShare?.toFixed(1)}%) generate at least 80% of known-zone bookings. The top ${p.topCount} zones generate ${p.topShare?.toFixed(1)}%.` : "Not enough reconciled known-zone demand to calculate concentration."}</p>
      <p className="mt-1 text-xs text-app-muted">{p.totalBookings.toLocaleString("en-GB")} known-zone bookings · {p.excludedUnknown.toLocaleString("en-GB")} unknown-zone bookings excluded. Demand, not profitability.</p>
      {p.available && <ol className="mt-4 space-y-3">{p.rows.map(row => <li key={row.key}><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{row.name}</span><span>{row.bookings.toLocaleString("en-GB")} · {row.share.toFixed(1)}% · cumulative {row.cumulativeShare.toFixed(1)}%</span></div><meter className="mt-1 h-3 w-full accent-brand" min={0} max={100} value={row.share} aria-label={`${row.name} share of known-zone demand`} /></li>)}</ol>}
    </div>
    <div><h4 className="font-semibold">Evidence-led SWOT</h4><p className="mt-1 text-xs text-app-muted">Provisional review · observations and hypotheses are labelled separately.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{review.findings.map(f => <article key={f.title} className="rounded-xl border border-app-border p-4"><p className="text-xs text-brand">{f.category} · {f.status}</p><h5 className="mt-2 font-medium">{f.title}</h5><p className="mt-2 text-sm text-app-muted">{f.evidence}</p></article>)}</div>{!review.findings.length && <p className="mt-3 text-sm text-app-muted">No selected bookings: no SWOT conclusions generated.</p>}</div>
    <div><h4 className="font-semibold">Next management decisions</h4><ol className="mt-3 space-y-3">{review.actions.map(a => <li key={a.title} className="rounded-xl border border-app-border p-4"><h5 className="font-medium">{a.title}</h5><p className="mt-2 text-sm text-app-muted">{a.reason}</p><p className="mt-2 text-xs text-app-muted">Measure: {a.measure}</p><p className="mt-2 text-xs text-app-muted">Owner: {a.owner} · Due: {a.due} · Proposed</p></li>)}</ol></div>
    <details className="text-xs text-app-muted"><summary>Business Review methodology</summary><ul className="mt-2 space-y-2">{review.limitations.map(l => <li key={l}>{l}</li>)}</ul></details>
  </section>;
}
