import type { CompanyMetricPeriod } from "@/lib/analytics/company";

type Props = {
  title: string;
  currentLabel: string;
  previousLabel: string;
  current: CompanyMetricPeriod;
  previous: CompanyMetricPeriod;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export default function PeriodComparisonCard({
  title,
  currentLabel,
  previousLabel,
  current,
  previous,
}: Props) {
  const revenueChange =
    previous.revenue === 0
      ? null
      : ((current.revenue - previous.revenue) /
          previous.revenue) *
        100;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-slate-500">
            {currentLabel}
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(current.revenue)}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {current.bookings.toLocaleString("en-GB")} bookings
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-500">
            {previousLabel}
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(previous.revenue)}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {previous.bookings.toLocaleString("en-GB")} bookings
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <p
          className={[
            "text-sm font-semibold",
            revenueChange === null
              ? "text-slate-400"
              : revenueChange > 0
                ? "text-emerald-400"
                : revenueChange < 0
                  ? "text-red-400"
                  : "text-slate-400",
          ].join(" ")}
        >
          {revenueChange === null
            ? "No previous revenue baseline"
            : `${revenueChange >= 0 ? "↑" : "↓"} ${Math.abs(
                revenueChange,
              ).toFixed(1)}% revenue change`}
        </p>
      </div>
    </article>
  );
}
