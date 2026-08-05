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
  const positive =
    inverseTrend
      ? trend.direction === "DOWN"
      : trend.direction === "UP";

  const negative =
    inverseTrend
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
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
      <p className="text-sm font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-3 text-3xl font-bold tracking-tight text-white">
        {value}
      </p>

      {trend ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
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
            vs previous period
          </span>
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </article>
  );
}
