import type { ReactNode } from "react";

type EntitySummaryProps = {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  initials?: string;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
};

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function EntitySummary({
  title,
  subtitle,
  meta,
  initials,
  badge,
  action,
  className = "",
}: EntitySummaryProps) {
  const resolvedInitials =
    initials || getInitials(title) || "?";

  return (
    <div
      className={[
        "flex items-start justify-between gap-4",
        className,
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="app-avatar">
          {resolvedInitials}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="app-entity-title truncate">
              {title}
            </p>

            {badge}
          </div>

          {subtitle ? (
            <p className="app-entity-meta truncate">
              {subtitle}
            </p>
          ) : null}

          {meta ? (
            <p className="app-entity-meta truncate">
              {meta}
            </p>
          ) : null}
        </div>
      </div>

      {action ? (
        <div className="shrink-0">
          {action}
        </div>
      ) : null}
    </div>
  );
}
