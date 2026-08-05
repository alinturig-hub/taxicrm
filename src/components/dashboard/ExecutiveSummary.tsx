import type { CompanyMetrics } from "@/lib/analytics/company";

type Props = {
  metrics: CompanyMetrics;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export default function ExecutiveSummary({
  metrics,
}: Props) {
  const revenueTrend = metrics.trends.revenueVsYesterday;
  const bookingTrend = metrics.trends.bookingsVsYesterday;

  const revenueSignal =
    revenueTrend.changePercent === null
      ? "No revenue baseline for yesterday."
      : `Revenue ${
          revenueTrend.direction === "UP"
            ? "increased"
            : revenueTrend.direction === "DOWN"
              ? "decreased"
              : "remained unchanged"
        } by ${Math.abs(
          revenueTrend.changePercent,
        ).toFixed(1)}%.`;

  const bookingSignal =
    bookingTrend.changePercent === null
      ? "No booking baseline for yesterday."
      : `Booking volume ${
          bookingTrend.direction === "UP"
            ? "increased"
            : bookingTrend.direction === "DOWN"
              ? "decreased"
              : "remained unchanged"
        } by ${Math.abs(
          bookingTrend.changePercent,
        ).toFixed(1)}%.`;

  const signals = [
    `Revenue today: ${formatCurrency(
      metrics.today.revenue,
    )}.`,
    revenueSignal,
    bookingSignal,
    `Completion rate: ${metrics.today.completionRate.toFixed(
      1,
    )}%.`,
    `Estimated revenue lost: ${formatCurrency(
      metrics.today.estimatedRevenueLost,
    )}.`,
  ];

  return (
    <article className="rounded-xl border border-violet-900/60 bg-violet-950/30 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">
        Executive Summary
      </p>

      <h2 className="mt-2 text-lg font-bold text-white">
        Today&apos;s business signal
      </h2>

      <ul className="mt-4 space-y-2.5">
        {signals.map((signal) => (
          <li
            key={signal}
            className="flex items-start gap-2.5 text-xs leading-5 text-slate-300 sm:text-sm"
          >
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
            <span>{signal}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
