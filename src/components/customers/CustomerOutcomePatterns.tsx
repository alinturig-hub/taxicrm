"use client";

export type OutcomePatterns = {
  completed: number; cancelled: number; noFare: number; total: number;
  cancellationPercent: number | null; noFarePercent: number | null;
  afterBookingMedianMinutes: number | null; afterBookingSamples: number;
  afterDispatchMedianMinutes: number | null; afterDispatchSamples: number;
  beforePickupMedianMinutes: number | null; beforePickupSamples: number;
  cancellationAfterPickupCount: number; undatedExcluded: number; futureExcluded: number;
};
function percent(value: number | null) { return value === null ? "Not enough data" : `${value}%`; }
function duration(value: number | null, samples: number) {
  return value === null ? "Not recorded" : `${value} min · ${samples} ${samples === 1 ? "booking" : "bookings"}`;
}
export default function CustomerOutcomePatterns({ patterns: p }: { patterns: OutcomePatterns }) {
  return <section aria-label="Recorded booking outcome patterns" className="rounded-2xl border border-app-border bg-surface p-5 text-app-primary">
    <h3 className="font-semibold">Recorded booking outcome patterns</h3>
    <p className="mt-2 text-sm text-app-muted">Based on {p.total} dated bookings with a recorded final status: completed, cancelled or no fare. This describes history, not a prediction or a reason.</p>
    {p.total > 0 && p.total < 10 && <p className="mt-2 text-sm text-amber-300">Small sample: interpret percentages with care.</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-app-border p-4"><p className="text-sm text-app-muted">Cancellations</p><p className="mt-1 font-semibold">{p.cancelled} · {percent(p.cancellationPercent)}</p></div>
      <div className="rounded-xl border border-app-border p-4"><p className="text-sm text-app-muted">No-fare bookings</p><p className="mt-1 font-semibold">{p.noFare} · {percent(p.noFarePercent)}</p></div>
      <div className="rounded-xl border border-app-border p-4"><p className="text-sm text-app-muted">Completed</p><p className="mt-1 font-semibold">{p.completed}</p></div>
      <div className="rounded-xl border border-app-border p-4"><p className="text-sm text-app-muted">Typical time from booking to cancellation</p><p className="mt-1 font-semibold">{duration(p.afterBookingMedianMinutes, p.afterBookingSamples)}</p></div>
      <div className="rounded-xl border border-app-border p-4"><p className="text-sm text-app-muted">Typical time from dispatch to cancellation</p><p className="mt-1 font-semibold">{duration(p.afterDispatchMedianMinutes, p.afterDispatchSamples)}</p></div>
      <div className="rounded-xl border border-app-border p-4"><p className="text-sm text-app-muted">Typical cancellation time before scheduled pickup</p><p className="mt-1 font-semibold">{duration(p.beforePickupMedianMinutes, p.beforePickupSamples)}</p></div>
    </div>
    <p className="mt-4 text-xs text-app-muted">Times are medians of valid recorded timestamp pairs. {p.cancellationAfterPickupCount} cancellations were recorded after the scheduled pickup time. A no-fare status alone does not confirm a customer no-show or who was responsible.</p>
    {(p.undatedExcluded > 0 || p.futureExcluded > 0) && <p className="mt-2 text-xs text-app-muted">Excluded from the summary: {p.undatedExcluded} without a usable date and {p.futureExcluded} future-dated.</p>}
  </section>;
}
