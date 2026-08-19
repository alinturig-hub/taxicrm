import type { KeyboardEvent, ReactNode } from "react";

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
  onClick?: () => void;
  active?: boolean;
};

const trendStyles: Record<KpiTrend["direction"], string> = {
  up: "bg-emerald-50 text-emerald-700",
  down: "bg-red-50 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
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
  onClick,
  active = false,
}: KpiCardProps) {
  const handleKeyDown = (
    event: KeyboardEvent<HTMLElement>,
  ) => {
    if (!onClick) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };
  return (
    <article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? active : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={[
        "rounded-appLg border bg-white p-5 text-left shadow-card transition",
        onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          : "hover:border-app-border-strong",
        active
          ? "border-blue-500 ring-2 ring-blue-500/20"
          : "border-app-border",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-app-muted">
            {title}
          </p>

          <p className="mt-3 truncate text-2xl font-bold tracking-tight text-app-primary sm:text-3xl">
            {value}
          </p>
        </div>

        {icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-appMd border border-app-border bg-surface-subtle text-lg text-app-secondary">
            {icon}
          </div>
        ) : null}
      </div>

      {(description || trend) ? (
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
            <p className="text-xs leading-5 text-app-muted">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
