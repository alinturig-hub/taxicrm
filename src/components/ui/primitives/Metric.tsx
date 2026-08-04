import type { ReactNode } from "react";

type MetricTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "ai";

type MetricProps = {
  label: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  tone?: MetricTone;
  className?: string;
};

const toneClasses: Record<MetricTone, string> = {
  default: "",
  success: "border-emerald-200 bg-emerald-50/60",
  warning: "border-amber-200 bg-amber-50/60",
  danger: "border-red-200 bg-red-50/60",
  ai: "border-violet-200 bg-violet-50/60",
};

export default function Metric({
  label,
  value,
  description,
  icon,
  tone = "default",
  className = "",
}: MetricProps) {
  return (
    <article
      className={[
        "app-metric",
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="app-label">{label}</p>
          <div className="app-metric-value">{value}</div>
        </div>

        {icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-appMd border border-app-border bg-white text-app-secondary">
            {icon}
          </div>
        ) : null}
      </div>

      {description ? (
        <p className="app-metric-description">
          {description}
        </p>
      ) : null}
    </article>
  );
}
