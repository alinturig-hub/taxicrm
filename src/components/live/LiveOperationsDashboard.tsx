"use client";

import OperationalAlertCard from "@/components/live/OperationalAlertCard";
import RecentActivityCard from "@/components/live/RecentActivityCard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BookingTimelineDrawer, {
  type BookingDrawerData,
} from "@/components/live/BookingTimelineDrawer";

type LiveOperations = {
  generatedAt: string;
  bookings: {
    active: number;
    created: number;
    dispatched: number;
    accepted: number;
    arrived: number;
    passengerOnBoard: number;
    completedToday: number;
    cancelledToday: number;
    noFareToday: number;
    waitingPickup: number;
    withoutDriver: number;
  };
  fleet: {
    totalTracked: number;
    live: number;
    stale: number;
    clear: number;
    busy: number;
    notWorking: number;
  };
  drivers: {
    onShift: number;
    withVehicle: number;
    withoutVehicle: number;
  };
  alerts: {
    total: number;
    staleVehicles: number;
    bookingsWithoutDriver: number;
    acceptedOver15Minutes: number;
    driversWithoutVehicle: number;
    items: Array<{
      id: string;
      severity:
        | "critical"
        | "warning"
        | "info"
        | "success";
      title: string;
      subtitle?: string;
      bookingId?: string;
      occurredAt: string;
    }>;
  };
  recentActivity: Array<{
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    bookingId: string;
    externalBookingId: string;
    status: string;
    customerName: string | null;
    driverName: string | null;
    pickupAddress: string | null;
    destinationAddress: string | null;
    fare: number | null;
    occurredAt: string;
  }>;
};

type ApiResponse = {
  success: boolean;
  refreshAfterSeconds?: number;
  operations?: LiveOperations;
};

type SocketState = "CONNECTING" | "LIVE" | "OFFLINE";

function formatTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

type StatAccent =
  | "blue"
  | "emerald"
  | "violet"
  | "red";

const statAccentClasses: Record<
  StatAccent,
  {
    bar: string;
    icon: string;
    glow: string;
  }
> = {
  blue: {
    bar: "bg-blue-500",
    icon:
      "border-blue-500/30 bg-blue-500/10 text-blue-300",
    glow: "hover:shadow-blue-950/40",
  },
  emerald: {
    bar: "bg-emerald-500",
    icon:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    glow: "hover:shadow-emerald-950/40",
  },
  violet: {
    bar: "bg-violet-500",
    icon:
      "border-violet-500/30 bg-violet-500/10 text-violet-300",
    glow: "hover:shadow-violet-950/40",
  },
  red: {
    bar: "bg-red-500",
    icon:
      "border-red-500/30 bg-red-500/10 text-red-300",
    glow: "hover:shadow-red-950/40",
  },
};

function StatCard({
  label,
  value,
  description,
  icon,
  accent,
}: {
  label: string;
  value: number;
  description: string;
  icon: string;
  accent: StatAccent;
}) {
  const classes = statAccentClasses[accent];

  return (
    <article
      className={[
        "group relative min-h-[150px] overflow-hidden rounded-2xl",
        "border border-slate-800/90 bg-slate-900/80 p-4",
        "shadow-lg shadow-black/10 backdrop-blur-sm",
        "transition duration-200",
        "hover:-translate-y-0.5 hover:border-slate-700",
        "hover:shadow-xl",
        classes.glow,
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-x-0 top-0 h-1",
          classes.bar,
        ].join(" ")}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 sm:text-sm">
            {label}
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {value.toLocaleString("en-GB")}
          </p>
        </div>

        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center",
            "rounded-xl border text-lg font-semibold",
            classes.icon,
          ].join(" ")}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      <p className="mt-3 max-w-[28ch] text-[11px] leading-4 text-slate-500 sm:text-xs">
        {description}
      </p>
    </article>
  );
}

type MetricTone =
  | "slate"
  | "blue"
  | "emerald"
  | "amber"
  | "red"
  | "violet";

const metricToneClasses: Record<
  MetricTone,
  {
    dot: string;
    badge: string;
  }
> = {
  slate: {
    dot: "bg-slate-400",
    badge: "border-slate-700 bg-slate-800/70 text-slate-200",
  },
  blue: {
    dot: "bg-blue-400",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  },
  emerald: {
    dot: "bg-emerald-400",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  amber: {
    dot: "bg-amber-400",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  red: {
    dot: "bg-red-400",
    badge: "border-red-500/30 bg-red-500/10 text-red-200",
  },
  violet: {
    dot: "bg-violet-400",
    badge:
      "border-violet-500/30 bg-violet-500/10 text-violet-200",
  },
};

function MetricRow({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: MetricTone;
}) {
  const classes = metricToneClasses[tone];

  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={[
            "h-2.5 w-2.5 shrink-0 rounded-full",
            classes.dot,
          ].join(" ")}
        />

        <span className="truncate text-sm text-slate-300">
          {label}
        </span>
      </div>

      <span
        className={[
          "inline-flex min-w-12 justify-center rounded-full",
          "border px-2.5 py-1 text-sm font-semibold",
          classes.badge,
        ].join(" ")}
      >
        {value.toLocaleString("en-GB")}
      </span>
    </div>
  );
}

type PipelineTone =
  | "slate"
  | "blue"
  | "cyan"
  | "emerald"
  | "violet"
  | "amber";

const pipelineToneClasses: Record<
  PipelineTone,
  {
    bar: string;
    badge: string;
  }
> = {
  slate: {
    bar: "bg-slate-500",
    badge:
      "border-slate-700 bg-slate-800/70 text-slate-200",
  },
  blue: {
    bar: "bg-blue-500",
    badge:
      "border-blue-500/30 bg-blue-500/10 text-blue-200",
  },
  cyan: {
    bar: "bg-cyan-400",
    badge:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  },
  emerald: {
    bar: "bg-emerald-500",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  violet: {
    bar: "bg-violet-500",
    badge:
      "border-violet-500/30 bg-violet-500/10 text-violet-200",
  },
  amber: {
    bar: "bg-amber-500",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
};

function PipelineStage({
  label,
  value,
  maximum,
  tone,
}: {
  label: string;
  value: number;
  maximum: number;
  tone: PipelineTone;
}) {
  const percentage =
    maximum > 0
      ? Math.max(
          value > 0 ? 4 : 0,
          Math.min(100, (value / maximum) * 100),
        )
      : 0;

  const classes = pipelineToneClasses[tone];

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-slate-300">
          {label}
        </span>

        <span
          className={[
            "inline-flex min-w-12 justify-center rounded-full",
            "border px-2.5 py-1 text-sm font-semibold",
            classes.badge,
          ].join(" ")}
        >
          {value.toLocaleString("en-GB")}
        </span>
      </div>

      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-950/80 ring-1 ring-inset ring-slate-800">
        <div
          className={[
            "h-full rounded-full transition-[width] duration-500",
            classes.bar,
          ].join(" ")}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function LiveOperationsDashboard() {
  const [operations, setOperations] =
    useState<LiveOperations | null>(null);
  const [loading, setLoading] = useState(true);
  const [socketState, setSocketState] =
    useState<SocketState>("CONNECTING");
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [loadingBooking, setLoadingBooking] =
    useState(false);

  const [selectedBooking, setSelectedBooking] =
    useState<BookingDrawerData | null>(null);

  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );


  const openBooking = useCallback(
    async (bookingId: string) => {
      try {
        setLoadingBooking(true);

        const response = await fetch(
          `/api/bookings/${bookingId}/timeline`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Booking request failed: ${response.status}`,
          );
        }

        const payload = await response.json();

        if (!payload.success) {
          throw new Error(
            "Booking could not be loaded.",
          );
        }

        setSelectedBooking(payload.booking);
        setDrawerOpen(true);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingBooking(false);
      }
    },
    [],
  );


  const closeBookingDrawer = useCallback(() => {
    setDrawerOpen(false);

    setTimeout(() => {
      setSelectedBooking(null);
    }, 250);
  }, []);

  const loadOperations = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/dashboard/live-operations",
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          `Live operations request failed: ${response.status}`,
        );
      }

      const payload = (await response.json()) as ApiResponse;

      if (!payload.success || !payload.operations) {
        throw new Error("Live operations data is unavailable.");
      }

      setOperations(payload.operations);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load live operations.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOperations();

    const pollingInterval = window.setInterval(() => {
      void loadOperations();
    }, 3_000);

    return () => {
      window.clearInterval(pollingInterval);
    };
  }, [loadOperations]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      setSocketState("CONNECTING");

      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";

      socket = new WebSocket(
        `${protocol}//${window.location.host}/ws/fleet`,
      );

      socket.addEventListener("open", () => {
        setSocketState("LIVE");
      });

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data as string) as {
            type?: string;
          };

          if (message.type === "fleet.vehicle.updated") {
            void loadOperations();
          }
        } catch {
          // Ignore malformed messages; polling remains the fallback.
        }
      });

      socket.addEventListener("close", () => {
        setSocketState("OFFLINE");

        if (!disposed) {
          reconnectTimer.current = setTimeout(connect, 2_000);
        }
      });

      socket.addEventListener("error", () => {
        setSocketState("OFFLINE");
        socket?.close();
      });
    };

    connect();

    return () => {
      disposed = true;

      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }

      socket?.close();
    };
  }, [loadOperations]);

  const socketClass = useMemo(() => {
    if (socketState === "LIVE") {
      return "border-emerald-800 bg-emerald-950/50 text-emerald-300";
    }

    if (socketState === "CONNECTING") {
      return "border-amber-800 bg-amber-950/50 text-amber-300";
    }

    return "border-red-800 bg-red-950/50 text-red-300";
  }, [socketState]);

  if (loading && !operations) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-sm text-slate-400">
          Loading live operations…
        </p>
      </main>
    );
  }

  if (!operations) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <p className="text-sm text-red-400">
          {error ?? "Live operations unavailable."}
        </p>
      </main>
    );
  }

  const alertItems = operations.alerts?.items ?? [];
  const recentActivity = operations.recentActivity ?? [];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-7 xl:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-2xl border border-slate-800/90 bg-slate-900/50 p-4 shadow-lg shadow-black/10 sm:flex sm:items-end sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 sm:text-sm">
              Live Operations
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl xl:text-4xl">
              Operational control centre
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 sm:text-sm">
              <span>
                Updated {formatTime(operations.generatedAt)}
              </span>

              <span className="hidden h-1 w-1 rounded-full bg-slate-600 sm:block" />

              <span>
                Monitoring{" "}
                <strong className="font-semibold text-slate-200">
                  {operations.bookings.active.toLocaleString(
                    "en-GB",
                  )}
                </strong>{" "}
                active bookings
              </span>
            </div>
          </div>

          <div
            className={[
              "mt-4 inline-flex w-fit items-center gap-2 rounded-full",
              "border px-3 py-1.5 text-xs font-semibold sm:mt-0",
              socketClass,
            ].join(" ")}
          >
            <span className="relative flex h-2.5 w-2.5">
              {socketState === "LIVE" ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-30" />
              ) : null}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
            </span>
            {socketState}
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-amber-900 bg-amber-950/30 p-3 text-xs text-amber-300">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          <StatCard
            label="Active Bookings"
            value={operations.bookings.active}
            description="Bookings currently in the operational lifecycle"
            icon="B"
            accent="blue"
          />

          <StatCard
            label="Drivers On Shift"
            value={operations.drivers.onShift}
            description="Drivers with an active recorded shift"
            icon="D"
            accent="emerald"
          />

          <StatCard
            label="Live Vehicles"
            value={operations.fleet.live}
            description="Vehicles seen during the last two minutes"
            icon="V"
            accent="violet"
          />

          <StatCard
            label="Alerts"
            value={operations.alerts.total}
            description="Operational exceptions requiring attention"
            icon="!"
            accent="red"
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <article className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/30 p-4 shadow-lg shadow-blue-950/10 sm:p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">
                  Fleet Status
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Current tracked vehicle availability
                </p>
              </div>

              <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.12em] text-blue-300">
                  Live ratio
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  {operations.fleet.totalTracked > 0
                    ? `${Math.round(
                        (operations.fleet.live /
                          operations.fleet.totalTracked) *
                          100,
                      )}%`
                    : "0%"}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <MetricRow
                label="Tracked vehicles"
                value={operations.fleet.totalTracked}
                tone="slate"
              />
              <MetricRow
                label="Live"
                value={operations.fleet.live}
                tone="emerald"
              />
              <MetricRow
                label="Clear"
                value={operations.fleet.clear}
                tone="blue"
              />
              <MetricRow
                label="Busy"
                value={operations.fleet.busy}
                tone="violet"
              />
              <MetricRow
                label="Stale"
                value={operations.fleet.stale}
                tone="amber"
              />
              <MetricRow
                label="Not working"
                value={operations.fleet.notWorking}
                tone="red"
              />
            </div>
          </article>

          <article className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 p-4 shadow-lg shadow-amber-950/10 sm:p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                  Booking Pipeline
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Current operational booking stages
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.12em] text-amber-300">
                  Active jobs
                </p>

                <p className="mt-1 text-lg font-bold text-white">
                  {operations.bookings.active.toLocaleString(
                    "en-GB",
                  )}
                </p>
              </div>
            </div>

            <div className="mt-3 divide-y divide-slate-800/70">
              {(() => {
                const stages = [
                  {
                    label: "Created",
                    value: operations.bookings.created,
                    tone: "slate" as const,
                  },
                  {
                    label: "Dispatched",
                    value: operations.bookings.dispatched,
                    tone: "blue" as const,
                  },
                  {
                    label: "Accepted",
                    value: operations.bookings.accepted,
                    tone: "cyan" as const,
                  },
                  {
                    label: "DAP",
                    value: operations.bookings.arrived,
                    tone: "amber" as const,
                  },
                  {
                    label: "Passenger on board",
                    value:
                      operations.bookings.passengerOnBoard,
                    tone: "violet" as const,
                  },
                ];

                const maximum = Math.max(
                  1,
                  ...stages.map((stage) => stage.value),
                );

                return stages.map((stage) => (
                  <PipelineStage
                    key={stage.label}
                    label={stage.label}
                    value={stage.value}
                    maximum={maximum}
                    tone={stage.tone}
                  />
                ));
              })()}
            </div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/20 p-4 shadow-lg shadow-red-950/10 sm:p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-orange-400 to-red-500" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">
                  Operational Alerts
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Exceptions requiring attention
                </p>
              </div>

              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200">
                {alertItems.length} active
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {alertItems.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <p className="text-sm font-semibold text-emerald-300">
                    No active operational alerts
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Current exceptions are within expected thresholds.
                  </p>
                </div>
              ) : (
                alertItems.map((alert) => (
                  <OperationalAlertCard
                    key={alert.id}
                    severity={alert.severity}
                    title={alert.title}
                    subtitle={alert.subtitle}
                    timestamp={formatTime(alert.occurredAt)}
                    onClick={() => {
                      if (alert.bookingId) {
                        console.log(
                          "Open booking",
                          alert.bookingId,
                        );
                      }
                    }}
                  />
                ))
              )}
            </div>
          </article>

          <article className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950/20 p-4 shadow-lg shadow-violet-950/10 sm:p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-violet-500" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
                  Recent Activity
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Latest booking lifecycle events
                </p>
              </div>

              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
                {recentActivity.length} events
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-sm text-slate-500">
                    No recent operational activity.
                  </p>
                </div>
              ) : (
                recentActivity.map((activity) => (
                  <RecentActivityCard
                    key={activity.id}
                    bookingId={activity.bookingId}
                    externalBookingId={
                      activity.externalBookingId
                    }
                    status={activity.status}
                    eventType={activity.eventType}
                    title={activity.title}
                    description={activity.description}
                    customerName={activity.customerName}
                    driverName={activity.driverName}
                    pickupAddress={activity.pickupAddress}
                    destinationAddress={
                      activity.destinationAddress
                    }
                    fare={activity.fare}
                    occurredAt={activity.occurredAt}
                    onClick={() => openBooking(activity.bookingId)}
                  />
                ))
              )}
            </div>
          </article>
        </section>
      </div>
      <BookingTimelineDrawer
        booking={loadingBooking ? null : selectedBooking}
        open={drawerOpen}
        onClose={closeBookingDrawer}
      />

      {loadingBooking && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <p className="text-sm font-medium text-white">
                Loading booking timeline...
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
