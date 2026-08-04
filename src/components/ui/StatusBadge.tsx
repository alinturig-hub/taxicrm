const styles = {
  created: "border-blue-200 bg-blue-50 text-blue-700",
  "on-hold": "border-amber-200 bg-amber-50 text-amber-700",
  dispatched: "border-orange-200 bg-orange-50 text-orange-700",
  accepted: "border-sky-200 bg-sky-50 text-sky-700",
  arrived: "border-cyan-200 bg-cyan-50 text-cyan-700",
  "on-board": "border-violet-200 bg-violet-50 text-violet-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  "no-fare": "border-yellow-200 bg-yellow-50 text-yellow-800",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-slate-200 bg-slate-100 text-slate-700",
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
  "no-fare": "No Fare",
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

function normalizeStatus(status: string): KnownStatus {
  const normalized = status.trim().toUpperCase();

  const statusMap: Record<string, KnownStatus> = {
    CREATED: "created",
    ACTIVE: "active",
    ON_HOLD: "on-hold",
    ONHOLD: "on-hold",
    DISPATCHED: "dispatched",
    ACCEPTED: "accepted",
    ARRIVED: "arrived",
    POB: "on-board",
    ON_BOARD: "on-board",
    PASSENGER_ON_BOARD: "on-board",
    COMPLETED: "completed",
    COMPLETE: "completed",
    CANCELLED: "cancelled",
    CANCELED: "cancelled",
    REJECTED: "rejected",
    NO_FARE: "no-fare",
    NOFARE: "no-fare",
    INACTIVE: "inactive",
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "error",
    FAILED: "error",
    INFO: "info",
  };

  return statusMap[normalized] ?? "info";
}

export default function StatusBadge({
  status,
  label,
}: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap",
        styles[normalizedStatus],
      ].join(" ")}
    >
      {label ?? labels[normalizedStatus]}
    </span>
  );
}
