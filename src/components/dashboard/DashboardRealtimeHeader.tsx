"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(date);
}

export default function DashboardRealtimeHeader() {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [lastRefresh, setLastRefresh] =
    useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    setLastRefresh(new Date());

    const clockInterval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    let socket: WebSocket | null = null;
    let reconnectTimer:
      | ReturnType<typeof setTimeout>
      | null = null;
    let disposed = false;

    const refreshDashboard = () => {
      router.refresh();
      setLastRefresh(new Date());
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      const protocol =
        window.location.protocol === "https:"
          ? "wss:"
          : "ws:";

      socket = new WebSocket(
        `${protocol}//${window.location.host}/ws/fleet`,
      );

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(
            event.data as string,
          ) as {
            type?: string;
          };

          if (
            message.type ===
            "dashboard.metrics.updated"
          ) {
            refreshDashboard();
          }
        } catch {
          // Ignore malformed WebSocket messages.
        }
      });

      socket.addEventListener("close", () => {
        if (!disposed) {
          reconnectTimer = setTimeout(
            connect,
            2000,
          );
        }
      });

      socket.addEventListener("error", () => {
        socket?.close();
      });
    };

    connect();

    const fallbackInterval = window.setInterval(
      refreshDashboard,
      60000,
    );

    return () => {
      disposed = true;

      window.clearInterval(clockInterval);
      window.clearInterval(fallbackInterval);

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      socket?.close();
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-400">
          Executive Dashboard
        </p>

        <h1 className="mt-3 font-sans text-3xl font-extrabold tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
          Company Performance
        </h1>

        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-400 sm:text-base">
          Live financial and operational intelligence
          calculated from real company data.
        </p>
      </div>

      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]" />

          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            Live
          </p>
        </div>

        <p className="mt-2 text-base font-bold text-white sm:text-lg">
          Today
        </p>

        <p className="mt-1 min-w-64 text-sm font-medium tabular-nums text-slate-300">
          {now ? formatDateTime(now) : "Loading time…"}
        </p>

        <p className="mt-2 text-[11px] text-slate-500">
          Dashboard updates instantly from live webhook events
          {lastRefresh
            ? ` · Last refresh ${lastRefresh.toLocaleTimeString(
                "en-GB",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZone: "Europe/London",
                },
              )}`
            : ""}
        </p>
      </div>
    </div>
  );
}
