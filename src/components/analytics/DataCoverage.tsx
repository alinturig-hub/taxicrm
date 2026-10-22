import React from "react";
import type { AnalyticsData } from "@/lib/analytics/explorer/model";
const count = (n: number) => n.toLocaleString("en-GB");
const date = (s: string) => new Date(s).toLocaleString("en-GB", {
  timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short",
});
export default function DataCoverage({ data }: { data: AnalyticsData }) {
  const t = data.totals;
  const payment = { ALL: "All payment methods", CASH: "Cash", ACCOUNT: "Account", CARD: "Card" }[data.range.payment];
  const metrics = [
    { label: "Price recorded", present: t.completed - t.missingPrice, total: t.completed, unit: "completed bookings" },
    { label: "Driver Cost recorded", present: t.completed - t.missingCost, total: t.completed, unit: "completed bookings" },
    { label: "Pickup zone identified", present: t.total - t.unknownArea, total: t.total, unit: "bookings" },
  ];
  return (
    <section aria-label="Data confidence" className="rounded-2xl border border-app-border bg-surface p-5">
      <h2 className="font-semibold">Data available for this period</h2>
      <p className="mt-2 text-sm text-app-primary">
        <strong>{count(t.total)} bookings</strong> selected · {count(t.completed)} completed · {payment}
      </p>
      <p className="mt-1 text-xs leading-5 text-app-muted">
        Pickup period: {date(data.range.from)} — {date(data.range.to)} (end exclusive), Europe/London.
        This report covers the selected period and payment filter, not the entire booking history.
        Change the dates above to analyse another period.
      </p>
      {t.total === 0 ? (
        <p className="mt-4 text-sm text-app-muted">No bookings match these filters. There is no coverage percentage to calculate.</p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {metrics.map(metric => (
            <div key={metric.label} className="rounded-xl border border-app-border p-4">
              <h3 className="text-xs text-app-muted">{metric.label}</h3>
              <p className="mt-2 text-lg font-semibold">
                {metric.total ? `${((metric.present / metric.total) * 100).toFixed(1)}%` : "No completed bookings"}
              </p>
              <p className="mt-1 text-xs text-app-muted">
                {count(metric.present)} of {count(metric.total)} {metric.unit}
              </p>
            </div>
          ))}
        </div>
      )}
      {!!(t.missingPrice || t.missingCost || t.unknownArea || t.other) && (
        <ul className="mt-4 space-y-2 text-sm text-app-muted">
          {!!t.missingPrice && <li>{count(t.missingPrice)} completed bookings have no Price.</li>}
          {!!t.missingCost && <li>{count(t.missingCost)} completed bookings have no driver Cost.</li>}
          {!!t.unknownArea && <li>{count(t.unknownArea)} bookings have no verified pickup zone; they remain in the totals.</li>}
          {!!t.other && <li>{count(t.other)} bookings have mixed, missing or other payment methods.</li>}
        </ul>
      )}
      {t.margin !== null && t.margin < 0 && (
        <p className="mt-3 text-sm text-app-muted">Recorded Price is below Cost overall. Review discounts and loyalty funding before attributing the difference to an operational loss.</p>
      )}
      <p className="mt-3 text-xs leading-5 text-app-muted">
        100% means the field is present on every eligible booking in this selection.
        It does not mean all historical bookings were included or that source accuracy was audited.
        Bookings without a pickup timestamp are outside this date-filtered report.
      </p>
    </section>
  );
}
