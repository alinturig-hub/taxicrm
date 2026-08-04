import type { ReactNode } from "react";

type InfoRowProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function InfoRow({
  label,
  value,
  description,
  action,
  className = "",
}: InfoRowProps) {
  return (
    <div className={["app-info-row", className].join(" ")}>
      <div className="min-w-0">
        <p className="app-label">{label}</p>

        <div className="mt-1 app-value">
          {value}
        </div>

        {description ? (
          <div className="mt-1 text-sm text-app-muted">
            {description}
          </div>
        ) : null}
      </div>

      {action ? (
        <div className="shrink-0">
          {action}
        </div>
      ) : null}
    </div>
  );
}
