type Props = {
  bookingId: string;
  externalBookingId: string;
  status: string;
  eventType: string;
  title: string;
  description: string | null;
  customerName: string | null;
  driverName: string | null;
  pickupAddress: string | null;
  destinationAddress: string | null;
  fare: number | null;
  occurredAt: string;
  onClick?: () => void;
};

type ActivityTone = {
  badge: string;
  icon: string;
  border: string;
  accent: string;
};

function getActivityTone(
  status: string,
  eventType: string,
): ActivityTone {
  const value = `${status} ${eventType}`.toUpperCase();

  if (
    value.includes("COMPLETED") ||
    value.includes("COMPLETE")
  ) {
    return {
      badge:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      icon: "✓",
      border: "hover:border-emerald-500/40",
      accent: "bg-emerald-400",
    };
  }

  if (
    value.includes("CANCELLED") ||
    value.includes("CANCELED") ||
    value.includes("REJECTED")
  ) {
    return {
      badge:
        "border-red-500/30 bg-red-500/10 text-red-200",
      icon: "!",
      border: "hover:border-red-500/40",
      accent: "bg-red-400",
    };
  }

  if (
    value.includes("POB") ||
    value.includes("PASSENGER")
  ) {
    return {
      badge:
        "border-violet-500/30 bg-violet-500/10 text-violet-200",
      icon: "P",
      border: "hover:border-violet-500/40",
      accent: "bg-violet-400",
    };
  }

  if (value.includes("ARRIVED")) {
    return {
      badge:
        "border-amber-500/30 bg-amber-500/10 text-amber-200",
      icon: "A",
      border: "hover:border-amber-500/40",
      accent: "bg-amber-400",
    };
  }

  if (value.includes("ACCEPTED")) {
    return {
      badge:
        "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
      icon: "A",
      border: "hover:border-cyan-500/40",
      accent: "bg-cyan-400",
    };
  }

  return {
    badge:
      "border-blue-500/30 bg-blue-500/10 text-blue-200",
    icon: "B",
    border: "hover:border-blue-500/40",
    accent: "bg-blue-400",
  };
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return null;
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function RecentActivityCard({
  externalBookingId,
  status,
  eventType,
  title,
  description,
  customerName,
  driverName,
  pickupAddress,
  destinationAddress,
  fare,
  occurredAt,
  onClick,
}: Props) {
  const tone = getActivityTone(status, eventType);
  const formattedFare = formatCurrency(fare);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative w-full overflow-hidden rounded-xl",
        "border border-slate-800 bg-slate-950/45 p-4 text-left",
        "transition duration-200",
        "hover:-translate-y-0.5 hover:bg-slate-950/70",
        "focus:outline-none focus:ring-2 focus:ring-violet-500/40",
        tone.border,
      ].join(" ")}
    >
      <div
        className={[
          "absolute bottom-0 left-0 top-0 w-1",
          tone.accent,
        ].join(" ")}
      />

      <div className="flex items-start gap-3 pl-1">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center",
            "rounded-lg border text-sm font-bold",
            tone.badge,
          ].join(" ")}
          aria-hidden="true"
        >
          {tone.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">
                Booking #{externalBookingId}
              </p>

              <p className="mt-0.5 text-xs text-slate-400">
                {title}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={[
                  "rounded-full border px-2 py-1",
                  "text-[10px] font-bold uppercase tracking-[0.1em]",
                  tone.badge,
                ].join(" ")}
              >
                {status}
              </span>

              <span className="font-mono text-[11px] text-slate-500">
                {formatTime(occurredAt)}
              </span>
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
            <p className="truncate">
              <span className="text-slate-500">Customer:</span>{" "}
              <span className="text-slate-200">
                {customerName ?? "Unknown"}
              </span>
            </p>

            <p className="truncate">
              <span className="text-slate-500">Driver:</span>{" "}
              <span className="text-slate-200">
                {driverName ?? "Unassigned"}
              </span>
            </p>
          </div>

          <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/70 px-3 py-2">
            <p className="truncate text-xs text-slate-300">
              {pickupAddress ?? "Pickup unavailable"}
            </p>

            <p className="my-1 text-[10px] text-slate-600">
              ↓
            </p>

            <p className="truncate text-xs text-slate-300">
              {destinationAddress ??
                "Destination unavailable"}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="truncate text-xs text-slate-500">
              {description ?? eventType}
            </p>

            <div className="flex shrink-0 items-center gap-3">
              {formattedFare ? (
                <span className="text-sm font-semibold text-white">
                  {formattedFare}
                </span>
              ) : null}

              <span className="text-sm text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-violet-300">
                →
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
