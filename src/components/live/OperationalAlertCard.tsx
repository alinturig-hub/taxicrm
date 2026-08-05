type Severity =
  | "critical"
  | "warning"
  | "info"
  | "success";

type Props = {
  severity: Severity;
  title: string;
  subtitle?: string;
  timestamp: string;
  onClick?: () => void;
};

const styles: Record<
  Severity,
  {
    border: string;
    background: string;
    badge: string;
    icon: string;
    label: string;
  }
> = {
  critical: {
    border: "border-red-500/40",
    background: "bg-red-950/30",
    badge: "bg-red-500/15 text-red-300",
    icon: "!",
    label: "Critical",
  },
  warning: {
    border: "border-amber-500/40",
    background: "bg-amber-950/30",
    badge: "bg-amber-500/15 text-amber-300",
    icon: "!",
    label: "Warning",
  },
  info: {
    border: "border-sky-500/40",
    background: "bg-sky-950/30",
    badge: "bg-sky-500/15 text-sky-300",
    icon: "i",
    label: "Info",
  },
  success: {
    border: "border-emerald-500/40",
    background: "bg-emerald-950/30",
    badge: "bg-emerald-500/15 text-emerald-300",
    icon: "✓",
    label: "Success",
  },
};

export default function OperationalAlertCard({
  severity,
  title,
  subtitle,
  timestamp,
  onClick,
}: Props) {
  const style = styles[severity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-xl border p-3 text-left",
        "transition duration-200",
        "hover:-translate-y-0.5 hover:border-slate-500",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/40",
        style.border,
        style.background,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={[
            "rounded-full px-2 py-1",
            "text-[10px] font-bold uppercase tracking-[0.12em]",
            style.badge,
          ].join(" ")}
        >
          {style.label}
        </span>

        <span className="font-mono text-[11px] text-slate-500">
          {timestamp}
        </span>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <span
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center",
            "rounded-lg border text-sm font-bold",
            style.border,
            style.badge,
          ].join(" ")}
          aria-hidden="true"
        >
          {style.icon}
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {title}
          </p>

          {subtitle ? (
            <p className="mt-1 truncate text-xs text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
