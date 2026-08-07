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
    week: Metrics;
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

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(
          `/api/dashboard/drivers/${driverId}`,
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
  }, [driverId]);

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
            Callsign {driver.callsign ?? "—"} · Autocab ID{" "}
            {driver.externalId}
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

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">
          Today
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <MetricCard
            label="Hours"
            value={analytics.today.hours}
          />
          <MetricCard
            label="Jobs"
            value={analytics.today.jobs}
          />
          <MetricCard
            label="Revenue"
            value={money(analytics.today.revenue)}
          />
          <MetricCard
            label="Completed"
            value={analytics.today.completed}
          />
          <MetricCard
            label="No Fare"
            value={analytics.today.noFare}
          />
          <MetricCard
            label="Cancelled"
            value={analytics.today.cancelled}
          />
          <MetricCard
            label="Rejections"
            value={analytics.today.rejections}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">
          This Week
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <MetricCard
            label="Hours"
            value={analytics.week.hours}
          />
          <MetricCard
            label="Jobs"
            value={analytics.week.jobs}
          />
          <MetricCard
            label="Revenue"
            value={money(analytics.week.revenue)}
          />
          <MetricCard
            label="Completed"
            value={analytics.week.completed}
          />
          <MetricCard
            label="No Fare"
            value={analytics.week.noFare}
          />
          <MetricCard
            label="Cancelled"
            value={analytics.week.cancelled}
          />
          <MetricCard
            label="Rejections"
            value={analytics.week.rejections}
          />
        </div>
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
                      vehicle.externalId}
                  </p>
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
