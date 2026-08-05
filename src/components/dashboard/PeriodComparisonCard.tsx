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
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
        {title}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 sm:text-sm">
            {currentLabel}
          </p>

          <p className="mt-1.5 truncate text-xl font-bold text-white sm:text-2xl">
            {formatCurrency(current.revenue)}
          </p>

          <p className="mt-1.5 text-xs text-slate-500">
            {current.bookings.toLocaleString("en-GB")} bookings
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-xs text-slate-500 sm:text-sm">
            {previousLabel}
          </p>

          <p className="mt-1.5 truncate text-xl font-bold text-white sm:text-2xl">
            {formatCurrency(previous.revenue)}
          </p>

          <p className="mt-1.5 text-xs text-slate-500">
            {previous.bookings.toLocaleString("en-GB")} bookings
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3">
        <p
          className={[
            "text-xs font-semibold sm:text-sm",
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
