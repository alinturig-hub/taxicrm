"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  };
  recentActivity: Array<{
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    bookingId: string;
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

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-medium text-slate-400 sm:text-sm">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
        {value.toLocaleString("en-GB")}
      </p>
      <p className="mt-2 text-[11px] leading-4 text-slate-500 sm:text-xs">
        {description}
      </p>
    </article>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-800 py-3 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-base font-semibold text-white">
        {value.toLocaleString("en-GB")}
      </span>
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

  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-7 xl:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 sm:text-sm">
              Live Operations
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl xl:text-4xl">
              Operational control centre
            </h1>
            <p className="mt-2 text-xs text-slate-400 sm:text-sm">
              Updated {formatTime(operations.generatedAt)}
            </p>
          </div>

          <div
            className={[
              "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
              socketClass,
            ].join(" ")}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
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
          />
          <StatCard
            label="Drivers On Shift"
            value={operations.drivers.onShift}
            description="Drivers with an active recorded shift"
          />
          <StatCard
            label="Live Vehicles"
            value={operations.fleet.live}
            description="Vehicles seen during the last two minutes"
          />
          <StatCard
            label="Alerts"
            value={operations.alerts.total}
            description="Operational exceptions requiring attention"
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
              Fleet Status
            </p>
            <div className="mt-3">
              <MetricRow
                label="Tracked vehicles"
                value={operations.fleet.totalTracked}
              />
              <MetricRow
                label="Live"
                value={operations.fleet.live}
              />
              <MetricRow
                label="Clear"
                value={operations.fleet.clear}
              />
              <MetricRow
                label="Busy"
                value={operations.fleet.busy}
              />
              <MetricRow
                label="Stale"
                value={operations.fleet.stale}
              />
              <MetricRow
                label="Not working"
                value={operations.fleet.notWorking}
              />
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
              Booking Pipeline
            </p>
            <div className="mt-3">
              <MetricRow
                label="Created"
                value={operations.bookings.created}
              />
              <MetricRow
                label="Dispatched"
                value={operations.bookings.dispatched}
              />
              <MetricRow
                label="Accepted"
                value={operations.bookings.accepted}
              />
              <MetricRow
                label="Arrived"
                value={operations.bookings.arrived}
              />
              <MetricRow
                label="Passenger on board"
                value={operations.bookings.passengerOnBoard}
              />
              <MetricRow
                label="Completed today"
                value={operations.bookings.completedToday}
              />
            </div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-xl border border-red-900/60 bg-red-950/20 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">
              Operational Alerts
            </p>
            <div className="mt-3">
              <MetricRow
                label="Stale vehicles"
                value={operations.alerts.staleVehicles}
              />
              <MetricRow
                label="Bookings without driver"
                value={operations.alerts.bookingsWithoutDriver}
              />
              <MetricRow
                label="Accepted over 15 minutes"
                value={
                  operations.alerts.acceptedOver15Minutes
                }
              />
              <MetricRow
                label="Drivers without vehicle"
                value={operations.alerts.driversWithoutVehicle}
              />
              <MetricRow
                label="Waiting pickup"
                value={operations.bookings.waitingPickup}
              />
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">
              Recent Activity
            </p>

            <div className="mt-3 divide-y divide-slate-800">
              {operations.recentActivity.length === 0 ? (
                <p className="py-4 text-sm text-slate-500">
                  No recent operational activity.
                </p>
              ) : (
                operations.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex gap-3 py-3"
                  >
                    <span className="w-16 shrink-0 text-xs text-slate-500">
                      {formatTime(activity.occurredAt)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {activity.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {activity.description ??
                          activity.eventType}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
