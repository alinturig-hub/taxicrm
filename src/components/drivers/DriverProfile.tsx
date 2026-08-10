"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Vehicle = {
  id: string;
  externalId: string;
  callsign: string | null;
  registration: string | null;
  plateNumber: string | null;
  make: string | null;
  model: string | null;
  ownerDriverId?: number | null;
  capabilities?: unknown;
};

type DriverProfileResponse = {
  success: boolean;
  driver?: {
    id: string;
    externalId: string;
    callsign: string | null;
    fullName: string | null;
    mobile: string | null;
    telephone: string | null;
    email: string | null;
    badgeNumber: string | null;
    licenceNumber: string | null;
    suspended: boolean;
    currentShift: {
      startedAt: string;
      vehicle: Vehicle | null;
    } | null;
    assignedVehicles: Vehicle[];
  };
  analytics?: {
    today: Metrics;
    yesterday: Metrics;
    week: Metrics;
    custom: (Metrics & {
      from: string | null;
      to: string | null;
    }) | null;
    weekRule: {
      timezone: string;
      starts: string;
      ends: string;
    };
  };
};

type Metrics = {
  hours: number;
  jobs: number;
  completed: number;
  noFare: number;
  cancelled: number;
  revenue: number;
  rejections: number;
  accepted: number;
  acceptanceRate: number;
  rejectionRate: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

export default function DriverProfile({
  driverId,
}: {
  driverId: string;
}) {
  const [data, setData] =
    useState<DriverProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] =
    useState<"today" | "yesterday" | "week" | "custom">(
      "today",
    );

  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);

        const params = new URLSearchParams();

        if (
          customFrom &&
          customTo
        ) {
          params.set("from", customFrom);
          params.set("to", customTo);
        }

        const query = params.toString();

        const response = await fetch(
          `/api/dashboard/drivers/${driverId}${
            query ? `?${query}` : ""
          }`,
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as DriverProfileResponse;

        setData(payload);
      } finally {
        setLoading(false);
      }
    })();
  }, [driverId, customFrom, customTo]);

  if (loading) {
    return (
      <div className="text-sm text-slate-400">
        Loading driver profile…
      </div>
    );
  }

  if (
    !data?.success ||
    !data.driver ||
    !data.analytics
  ) {
    return (
      <div className="text-sm text-red-300">
        Unable to load driver profile.
      </div>
    );
  }

  const { driver, analytics } = data;

  const selectedMetrics =
    period === "today"
      ? analytics.today
      : period === "yesterday"
        ? analytics.yesterday
        : period === "week"
          ? analytics.week
          : analytics.custom;

  const selectedTitle =
    period === "today"
      ? "Today"
      : period === "yesterday"
        ? "Yesterday"
        : period === "week"
          ? "This Week"
          : "Custom Period";

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/drivers"
        className="text-sm font-medium text-blue-400 hover:text-blue-300"
      >
        ← Back to Drivers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
            Driver Profile
          </p>

          <h1 className="mt-2 text-2xl font-bold text-white">
            {driver.fullName || "Unnamed driver"}
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Callsign {driver.callsign ?? "—"}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Autocab Driver ID {driver.externalId}
          </p>
        </div>

        <span
          className={[
            "rounded-full border px-3 py-1 text-xs font-semibold",
            driver.currentShift
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-slate-700 bg-slate-950 text-slate-400",
          ].join(" ")}
        >
          {driver.currentShift
            ? "On Shift"
            : "Off Shift"}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Analytics Period
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["week", "This Week"],
            ["custom", "Custom"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setPeriod(
                  value as
                    | "today"
                    | "yesterday"
                    | "week"
                    | "custom",
                )
              }
              className={[
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                period === value
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-slate-700 bg-slate-950 text-slate-400 hover:bg-slate-800",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {period === "custom" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-500">
                From
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(event) =>
                  setCustomFrom(event.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-500">
                To
              </label>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) =>
                  setCustomTo(event.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>
        ) : null}

        {period === "week" ? (
          <p className="mt-3 text-xs text-slate-500">
            Working week: Monday 00:00:00 to Sunday 23:59:59 · Europe/London
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">
          {selectedTitle}
        </h2>

        {selectedMetrics ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
            <MetricCard
              label="Hours"
              value={selectedMetrics.hours}
            />
            <MetricCard
              label="Jobs"
              value={selectedMetrics.jobs}
            />
            <MetricCard
              label="Revenue"
              value={money(selectedMetrics.revenue)}
            />
            <MetricCard
              label="Completed"
              value={selectedMetrics.completed}
            />
            <MetricCard
              label="No Fare"
              value={selectedMetrics.noFare}
            />
            <MetricCard
              label="Cancelled"
              value={selectedMetrics.cancelled}
            />
            <MetricCard
              label="Accepted"
              value={selectedMetrics.accepted}
            />
            <MetricCard
              label="Rejections"
              value={selectedMetrics.rejections}
            />
            <MetricCard
              label="Acceptance Rate"
              value={`${selectedMetrics.acceptanceRate.toFixed(2)}%`}
            />
            <MetricCard
              label="Rejection Rate"
              value={`${selectedMetrics.rejectionRate.toFixed(2)}%`}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-500">
            Select both dates to calculate the custom period.
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Vehicle
          </p>

          {driver.currentShift?.vehicle ? (
            <div className="mt-3">
              <p className="text-lg font-semibold text-white">
                Callsign{" "}
                {driver.currentShift.vehicle.callsign ?? "—"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {driver.currentShift.vehicle.registration ??
                  driver.currentShift.vehicle.plateNumber ??
                  "No registration"}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Not currently logged in.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assigned Vehicles
          </p>

          <div className="mt-3 space-y-2">
            {driver.assignedVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    Callsign {vehicle.callsign ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {vehicle.registration ??
                      vehicle.plateNumber ??
                      "No registration"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Autocab Vehicle ID {vehicle.externalId}
                  </p>

                  {Array.isArray(vehicle.capabilities) &&
                  vehicle.capabilities.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {vehicle.capabilities.map((capability) => (
                        <span
                          key={String(capability)}
                          className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-slate-400"
                        >
                          {String(capability)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <span className="text-xs font-medium text-slate-400">
                  {vehicle.ownerDriverId ===
                  Number(driver.externalId)
                    ? "Owner"
                    : "Allowed"}
                </span>
              </div>
            ))}

            {driver.assignedVehicles.length === 0 ? (
              <p className="text-sm text-slate-500">
                No assigned vehicles.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Contact & Licence
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Phone</p>
            <p className="mt-1 text-sm text-white">
              {driver.mobile ||
                driver.telephone ||
                "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Email</p>
            <p className="mt-1 text-sm text-white">
              {driver.email || "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Badge</p>
            <p className="mt-1 text-sm text-white">
              {driver.badgeNumber || "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">
              Licence
            </p>
            <p className="mt-1 text-sm text-white">
              {driver.licenceNumber || "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
