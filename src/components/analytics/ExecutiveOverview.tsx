"use client";
import React, { useState } from "react";
import { percentage, changePercent, topArea, type AnalyticsData } from "@/lib/analytics/explorer/model";
const count = (n: number) => n.toLocaleString("en-GB");
const pct = (n: number | null) => n === null ? "No bookings" : `${n.toFixed(1)}%`;
const money = (n: number | null) => n === null ? "Incomplete data" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const date = (s: string) => new Date(s).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
function delta(current: number, previous: number) {
  const value = changePercent(current, previous);
  return value === null ? (current ? "New activity · previous period was zero" : "No activity in either period") : `${value > 0 ? "+" : ""}${value.toFixed(1)}% vs previous period`;
}
function marginChange(current: number | null, previous: number | null | undefined) {
  if (current === null || previous == null) return "Comparison requires complete Price and Cost";
  const difference = current - previous;
  return `${difference > 0 ? "+" : ""}${money(difference)} vs previous period`;
}
export default function ExecutiveOverview({ data }: { data: AnalyticsData }) {
  const [sort, setSort] = useState<"total" | "noFare" | "cancelled" | "rejected" | "margin">("total");
  const t = data.totals, p = data.comparison;
  const unfulfilled = t.cancelled + t.noFare + t.rejected;
  const previousUnfulfilled = p && p.cancelled !== undefined && p.noFare !== undefined && p.rejected !== undefined
    ? p.cancelled + p.noFare + p.rejected : null;
  const areas = data.areas.filter(a => a.key !== "UNKNOWN" && (sort !== "margin" || a.completed > 0)).sort((a, b) => {
    if (a[sort] === null && b[sort] === null) return a.name.localeCompare(b.name);
    if (a[sort] === null) return 1;
    if (b[sort] === null) return -1;
    return Number(b[sort]) - Number(a[sort]) || a.name.localeCompare(b.name);
  }).slice(0, 10);
  const busyArea = topArea(data.areas, "total"), marginArea = topArea(data.areas, "margin");
  const reviewArea = data.areas.filter(a => a.key !== "UNKNOWN" && a.cancelled + a.noFare + a.rejected > 0)
    .sort((a, b) => (b.cancelled + b.noFare + b.rejected) - (a.cancelled + a.noFare + a.rejected) || a.name.localeCompare(b.name))[0];
  const previousAreas = p?.areas ? new Map(p.areas.map(a => [a.key, a.total])) : null;
  return (
    <div className="space-y-6">
      <section aria-label="Executive overview" className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-surface p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Business pulse</p>
        <h2 className="mt-2 text-xl font-semibold">Demand, margin and unfulfilled bookings</h2>
        <p className="mt-1 text-xs text-app-muted">Your selected pickup period · same payment filter throughout</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { name: "Booking demand", value: count(t.total), note: p ? delta(t.total, p.total) : "Comparison unavailable" },
            { name: "Company margin", value: t.completed ? money(t.margin) : "No completed jobs", note: t.completed ? marginChange(t.margin, p?.margin) : "No completed-job margin to compare" },
            { name: "Unfulfilled bookings", value: count(unfulfilled), note: `${pct(percentage(unfulfilled, t.total))} of selected bookings${previousUnfulfilled !== null ? ` · ${delta(unfulfilled, previousUnfulfilled)}` : ""}` },
            { name: "Recorded gross income", value: money(t.gross), note: t.missingPrice || p?.missingPrice ? "Missing Price · comparison withheld" : p ? delta(t.gross, p.gross) : "COMPLETED bookings only" },
          ].map(item => (
            <div key={item.name} className="min-w-0 rounded-xl border border-app-border bg-surface p-4">
              <h3 className="text-xs text-app-muted">{item.name}</h3>
              <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              <p className="mt-2 text-xs leading-5 text-app-muted">{item.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-app-muted">
          <span>Cancelled: {count(t.cancelled)} · {pct(percentage(t.cancelled, t.total))}</span>
          <span>Rejected: {count(t.rejected)} · {pct(percentage(t.rejected, t.total))}</span>
          <span>No fare: {count(t.noFare)} · {pct(percentage(t.noFare, t.total))}</span>
        </div>
        <p className="mt-3 text-xs leading-5 text-app-muted">Margin is completed-job Price − Cost, before rent, commissions and other expenses. Unfulfilled bookings are current cancelled, rejected and no-fare outcomes; no lost revenue or cause is assumed.</p>
        {p && (
          <details className="mt-4 text-xs text-app-muted">
            <summary className="cursor-pointer">Comparison methodology</summary>
            <p className="mt-2 leading-5">Previous pickup window: {date(p.from)} — {date(p.to)} (end exclusive), Europe/London. Same payment filter and equal elapsed duration, immediately before the selected window. This is not a matched weekday comparison; local hours may differ across daylight saving changes. Outcomes use the current booking status, not a reconstructed historical cutoff.</p>
          </details>
        )}
      </section>
      <section aria-label="Business focus" className="rounded-2xl border border-app-border bg-surface p-5">
        <h2 className="font-semibold">Where to focus</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 rounded-xl bg-brand/10 p-4">
            <h3 className="text-xs text-app-muted">Strongest recorded demand</h3>
            <p className="mt-2 font-semibold">{busyArea?.name ?? "No known pickup zones"}</p>
            <p className="mt-2 text-sm">{busyArea ? `${count(busyArea.total)} bookings${previousAreas ? ` · ${delta(busyArea.total, previousAreas.get(busyArea.key) ?? 0)}` : ""}` : "Area evidence required"}</p>
            <p className="mt-2 text-xs text-app-muted">Compare demand with actual driver availability before changing coverage.</p>
          </div>
          <div className="min-w-0 rounded-xl border border-app-border p-4">
            <h3 className="text-xs text-app-muted">Highest recorded area margin</h3>
            <p className="mt-2 font-semibold">{marginArea?.name ?? "Complete amounts required"}</p>
            <p className="mt-2 text-sm">{marginArea ? `${money(marginArea.margin)} · ${count(marginArea.completed)} completed bookings` : "No eligible completed-job comparison"}</p>
            <p className="mt-2 text-xs text-app-muted">Only known zones with complete Price and Cost qualify; negative margins remain visible.</p>
          </div>
          <div className="min-w-0 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <h3 className="text-xs text-app-muted">Most unfulfilled bookings to review</h3>
            <p className="mt-2 font-semibold">{reviewArea?.name ?? "No recorded area to flag"}</p>
            <p className="mt-2 text-sm">{reviewArea ? `${count(reviewArea.cancelled + reviewArea.noFare + reviewArea.rejected)} of ${count(reviewArea.total)} bookings · ${pct(percentage(reviewArea.cancelled + reviewArea.noFare + reviewArea.rejected, reviewArea.total))}` : "No cancelled, rejected or no-fare outcomes in known zones"}</p>
            <p className="mt-2 text-xs text-app-muted">Review reasons and allocation history. This count alone does not prove a driver shortage.</p>
          </div>
        </div>
        {!!t.unknownArea && <p className="mt-3 text-xs text-app-muted">{count(t.unknownArea)} bookings have no verified pickup zone. They remain in totals but cannot appear in area rankings.</p>}
      </section>
      <section aria-label="Area performance scorecard" className="rounded-2xl border border-app-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Which areas need attention?</h2><p className="mt-1 text-xs text-app-muted">Top 10 known pickup zones. Use volumes and rates together; small samples can produce extreme rates.</p></div>
          <label className="text-xs text-app-muted">Rank by
            <select aria-label="Rank areas by" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="ml-2 rounded-lg border border-app-border bg-surface px-3 py-2 text-app-primary">
              <option value="total">Bookings</option><option value="noFare">No fare volume</option><option value="cancelled">Cancellation volume</option><option value="rejected">Rejected volume</option><option value="margin">Recorded margin</option>
            </select>
          </label>
        </div>
        <div className="mt-4 space-y-3 sm:hidden">
          {areas.map(a => (
            <article key={a.key} className="rounded-xl border border-app-border p-4">
              <h3 className="font-semibold">{a.name}</h3>
              <p className="mt-1 text-sm">{count(a.total)} bookings</p>
              <p className="mt-1 text-xs text-app-muted">{previousAreas ? delta(a.total, previousAreas.get(a.key) ?? 0) : "Comparison unavailable"}</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                {[
                  ["Cancelled", `${count(a.cancelled)} · ${pct(percentage(a.cancelled, a.total))}`],
                  ["Rejected", `${count(a.rejected)} · ${pct(percentage(a.rejected, a.total))}`],
                  ["No fare", `${count(a.noFare)} · ${pct(percentage(a.noFare, a.total))}`],
                  ["Company margin", a.completed ? money(a.margin) : "No completed jobs"],
                  ["Gross income", `${money(a.gross)}${a.missingPrice ? " · partial" : ""}`],
                  ["Driver money", `${money(a.driverMoney)}${a.missingCost ? " · partial" : ""}`],
                ].map(([label, value]) => <div key={label}><dt className="text-app-muted">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}
              </dl>
            </article>
          ))}
        </div>
        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="border-b border-app-border text-xs text-app-muted"><tr>{["Pickup zone", "Bookings", "Demand change", "Cancelled", "Rejected", "No fare", "Gross income", "Driver money", "Price − Cost"].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{areas.map(a => (
              <tr key={a.key} className="border-b border-app-border last:border-0">
                <th scope="row" className="px-3 py-3 font-medium">{a.name}</th>
                <td className="px-3 py-3">{count(a.total)}</td>
                <td className="px-3 py-3 text-xs">{previousAreas ? delta(a.total, previousAreas.get(a.key) ?? 0) : "Comparison unavailable"}</td>
                <td className="px-3 py-3">{count(a.cancelled)} · {pct(percentage(a.cancelled, a.total))}</td>
                <td className="px-3 py-3">{count(a.rejected)} · {pct(percentage(a.rejected, a.total))}</td>
                <td className="px-3 py-3">{count(a.noFare)} · {pct(percentage(a.noFare, a.total))}</td>
                <td className="px-3 py-3">{money(a.gross)}{a.missingPrice ? " · partial" : ""}</td>
                <td className="px-3 py-3">{money(a.driverMoney)}{a.missingCost ? " · partial" : ""}</td>
                <td className="px-3 py-3">{a.completed ? money(a.margin) : "No completed jobs"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {!areas.length && <p className="mt-3 text-sm text-app-muted">No known pickup zones in this selection.</p>}
      </section>
    </div>
  );
}
