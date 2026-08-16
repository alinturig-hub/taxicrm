"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type DriverVehicle = {
  id: string;
  externalId: string;
  callsign: string | null;
  registration: string | null;
  plateNumber: string | null;
  make: string | null;
  model: string | null;
  currentStatus: string | null;
  lastSeenAt: string | null;
};

type DriverRecord = {
  id: string;
  externalId: string;
  callsign: string | null;
  fullName: string;
  mobile: string | null;
  telephone: string | null;
  email: string | null;
  badgeNumber: string | null;
  licenceNumber: string | null;
  suspended: boolean;
  badgeExpiryDate: string | null;
  licenceExpiryDate: string | null;
  insuranceExpiryDate: string | null;
  shift: {
    id: string;
    startedAt: string;
  } | null;
  vehicle: DriverVehicle | null;
};

type DriversResponse = {
  success: boolean;
  drivers?: DriverRecord[];
  message?: string;
};

function vehicleLabel(vehicle: DriverVehicle | null) {
  if (!vehicle) {
    return "No vehicle";
  }

  const name = [vehicle.make, vehicle.model]
    .filter(Boolean)
    .join(" ");

  return (
    vehicle.callsign ||
    vehicle.registration ||
    vehicle.plateNumber ||
    name ||
    `Vehicle ${vehicle.externalId}`
  );
}

export default function DriversDashboard() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadDrivers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/dashboard/drivers", {
        cache: "no-store",
      });

      const payload =
        (await response.json()) as DriversResponse;

      if (
        !response.ok ||
        !payload.success ||
        !payload.drivers
      ) {
        throw new Error(
          payload.message ?? "Unable to load drivers.",
        );
      }

      setDrivers(payload.drivers);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load drivers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrivers();
  }, [loadDrivers]);

  async function syncDrivers() {
    try {
      setSyncing(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        "/api/dashboard/integrations/autocab/drivers/sync",
        {
          method: "POST",
          cache: "no-store",
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.result) {
        throw new Error(
          payload.message ?? "Unable to synchronize drivers.",
        );
      }

      setMessage(
        `Sync complete: ${payload.result.recordsCreated} created, ${payload.result.recordsUpdated} updated, ${payload.result.recordsDisabled} disabled, ${payload.result.recordsFailed} failed.`,
      );

      await loadDrivers();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to synchronize drivers.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const filteredDrivers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return drivers;
    }

    return drivers.filter((driver) => {
      const values = [
        driver.callsign,
        driver.fullName,
        driver.mobile,
        driver.badgeNumber,
        driver.licenceNumber,
        driver.vehicle?.callsign,
        driver.vehicle?.registration,
        driver.vehicle?.plateNumber,
      ];

      return values.some((value) =>
        value?.toLowerCase().includes(term),
      );
    });
  }, [drivers, search]);

  const onShift = drivers.filter(
    (driver) => driver.shift !== null,
  ).length;

  const suspended = drivers.filter(
    (driver) => driver.suspended,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
            Drivers
          </p>

          <h1 className="mt-2 text-2xl font-bold text-white">
            Driver Management
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Active drivers, live shift state and current vehicle allocation.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncDrivers()}
            disabled={syncing || loading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Synchronizing…" : "Sync Drivers Now"}
          </button>

          <button
            type="button"
            onClick={() => void loadDrivers()}
            disabled={loading || syncing}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active Drivers
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {drivers.length}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            On Shift
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {onShift}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
            Suspended
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {suspended}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search by callsign, driver, badge, licence or vehicle…"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-950/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shift
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Vehicle
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Badge / Licence
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {filteredDrivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-sm font-bold text-blue-300">
                        {driver.callsign ?? "—"}
                      </div>

                      <div>
                        <Link
                          href={`/dashboard/drivers/${driver.id}`}
                          className="font-semibold text-white hover:text-blue-300"
                        >
                          {driver.fullName || "Unnamed driver"}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          Autocab ID {driver.externalId}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    {driver.shift ? (
                      <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                        On Shift
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold text-slate-400">
                        Off Shift
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <p className="text-sm font-medium text-white">
                      {vehicleLabel(driver.vehicle)}
                    </p>

                    {driver.vehicle?.registration ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {driver.vehicle.registration}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-4">
                    <p className="text-sm text-slate-300">
                      {driver.mobile ||
                        driver.telephone ||
                        "—"}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <p className="text-sm text-slate-300">
                      {driver.badgeNumber
                        ? `Badge ${driver.badgeNumber}`
                        : "No badge"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {driver.licenceNumber
                        ? `Licence ${driver.licenceNumber}`
                        : "No licence"}
                    </p>
                  </td>
                </tr>
              ))}

              {!loading && filteredDrivers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    No drivers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
