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

  const revenueSentence =
    revenueTrend.changePercent === null
      ? "There is no comparable revenue baseline for yesterday."
      : `Revenue is ${
          revenueTrend.direction === "UP"
            ? "up"
            : revenueTrend.direction === "DOWN"
              ? "down"
              : "unchanged"
        } by ${Math.abs(
          revenueTrend.changePercent,
        ).toFixed(1)}% compared with yesterday.`;

  const bookingSentence =
    bookingTrend.changePercent === null
      ? "There is no comparable booking baseline for yesterday."
      : `Booking volume is ${
          bookingTrend.direction === "UP"
            ? "up"
            : bookingTrend.direction === "DOWN"
              ? "down"
              : "unchanged"
        } by ${Math.abs(
          bookingTrend.changePercent,
        ).toFixed(1)}%.`;

  return (
    <article className="rounded-2xl border border-violet-900/60 bg-violet-950/30 p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-400">
        Executive Summary
      </p>

      <h2 className="mt-3 text-xl font-bold text-white">
        Today&apos;s business signal
      </h2>

      <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
        <p>
          Revenue today is{" "}
          <strong className="text-white">
            {formatCurrency(metrics.today.revenue)}
          </strong>
          .
        </p>

        <p>{revenueSentence}</p>
        <p>{bookingSentence}</p>

        <p>
          Completion rate is{" "}
          <strong className="text-white">
            {metrics.today.completionRate.toFixed(1)}%
          </strong>
          .
        </p>

        <p>
          Estimated revenue lost through cancellations and
          no-fare bookings is{" "}
          <strong className="text-white">
            {formatCurrency(
              metrics.today.estimatedRevenueLost,
            )}
          </strong>
          .
        </p>
      </div>
    </article>
  );
}
