import type { ReactNode } from "react";

type KpiTrend = {
  value: string;
  direction: "up" | "down" | "neutral";
};

type KpiCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: KpiTrend;
};

const trendStyles: Record<KpiTrend["direction"], string> = {
  up: "bg-emerald-500/10 text-emerald-400",
  down: "bg-red-500/10 text-red-400",
  neutral: "bg-slate-800 text-slate-400",
};

const trendSymbols: Record<KpiTrend["direction"], string> = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

export default function KpiCard({
  title,
  value,
  description,
  icon,
  trend,
}: KpiCardProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-400">{title}</p>

          <p className="mt-3 truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {value}
          </p>
        </div>

        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-lg text-slate-300">
            {icon}
          </div>
        ) : null}
      </div>

      {(description || trend) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {trend ? (
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                trendStyles[trend.direction],
              ].join(" ")}
            >
              <span>{trendSymbols[trend.direction]}</span>
              <span>{trend.value}</span>
            </span>
          ) : null}

          {description ? (
            <p className="text-xs leading-5 text-slate-500">{description}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}
