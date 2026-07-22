const styles = {
  created: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "on-hold": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  dispatched: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  arrived: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "on-board": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  rejected: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "no-show": "bg-slate-600/20 text-slate-300 border-slate-600/30",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  inactive: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  success: "bg-green-500/10 text-green-400 border-green-500/20",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
} as const;

const labels = {
  created: "Created",
  "on-hold": "On Hold",
  dispatched: "Dispatched",
  accepted: "Accepted",
  arrived: "Arrived",
  "on-board": "Passenger On Board",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  "no-show": "No Show",
  active: "Active",
  inactive: "Inactive",
  success: "Success",
  warning: "Warning",
  error: "Error",
  info: "Info",
} as const;

type KnownStatus = keyof typeof styles;

type StatusBadgeProps = {
  status: string;
  label?: string;
};

export default function StatusBadge({
  status,
  label,
}: StatusBadgeProps) {
  const normalizedStatus: KnownStatus =
    status in styles ? (status as KnownStatus) : "info";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        styles[normalizedStatus],
      ].join(" ")}
    >
      {label ?? labels[normalizedStatus]}
    </span>
  );
}
