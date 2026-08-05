import type { MetricTrend } from "@/lib/analytics/company";

type Props = {
  label: string;
  value: string;
  description: string;
  trend?: MetricTrend;
  inverseTrend?: boolean;
};

function trendClasses(
  trend: MetricTrend,
  inverseTrend: boolean,
) {
  const positive = inverseTrend
    ? trend.direction === "DOWN"
    : trend.direction === "UP";

  const negative = inverseTrend
    ? trend.direction === "UP"
    : trend.direction === "DOWN";

  if (positive) {
    return "text-emerald-400";
  }

  if (negative) {
    return "text-red-400";
  }

  return "text-slate-400";
}

function trendSymbol(direction: MetricTrend["direction"]) {
  if (direction === "UP") {
    return "↑";
  }

  if (direction === "DOWN") {
    return "↓";
  }

  return "→";
}

export default function ExecutiveKpiCard({
  label,
  value,
  description,
  trend,
  inverseTrend = false,
}: Props) {
  return (
    <article className="flex min-h-[156px] flex-col rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-lg sm:min-h-[168px]">
      <p className="text-xs font-medium text-slate-400 sm:text-sm">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-white lg:text-3xl">
        {value}
      </p>

      {trend ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
          <span
            className={[
              "font-semibold",
              trendClasses(trend, inverseTrend),
            ].join(" ")}
          >
            {trendSymbol(trend.direction)}{" "}
            {trend.changePercent === null
              ? "New activity"
              : `${Math.abs(trend.changePercent).toFixed(1)}%`}
          </span>

          <span className="text-slate-500">
            vs previous
          </span>
        </div>
      ) : null}

      <p className="mt-auto pt-3 text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5">
        {description}
      </p>
    </article>
  );
}
