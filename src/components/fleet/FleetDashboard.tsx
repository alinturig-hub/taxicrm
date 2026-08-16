"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Vehicle = {
  id: string;
  externalId: string;
  companyId: number | null;
  callsign: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  yearOfManufacture: number | null;
  vehicleType: string | null;
  registration: string | null;
  plateNumber: string | null;
  isSuspended: boolean;
  isActive: boolean;
  currentStatus: string | null;
  currentBookingId: number | null;
  currentLatitude: string | number | null;
  currentLongitude: string | number | null;
  lastSeenAt: string | null;
  currentDriver: {
    id: string;
    externalId: string;
    callsign: string | null;
    forename: string | null;
    surname: string | null;
  } | null;
};

type FleetResponse = {
  success: boolean;
  total?: number;
  vehicles?: Vehicle[];
  message?: string;
};

function driverName(vehicle: Vehicle) {
  const driver = vehicle.currentDriver;

  if (!driver) {
    return "—";
  }

  const name = [driver.forename, driver.surname]
    .filter(Boolean)
    .join(" ");

  return (
    driver.callsign ||
    name ||
    driver.externalId
  );
}

export default function FleetDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        "/api/dashboard/fleet",
        { cache: "no-store" },
      );

      const payload =
        (await response.json()) as FleetResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ?? "Unable to load fleet.",
        );
      }

      setVehicles(payload.vehicles ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load fleet.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  async function syncVehicles() {
    try {
      setSyncing(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        "/api/dashboard/integrations/autocab/vehicles/sync",
        {
          method: "POST",
          cache: "no-store",
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.result) {
        throw new Error(
          payload.message ?? "Unable to synchronize vehicles.",
        );
      }

      setMessage(
        `Sync complete: ${payload.result.recordsCreated} created, ${payload.result.recordsUpdated} updated, ${payload.result.recordsDisabled} disabled, ${payload.result.recordsFailed} failed.`,
      );

      await loadVehicles();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to synchronize vehicles.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return vehicles;
    }

    return vehicles.filter((vehicle) =>
      [
        vehicle.callsign,
        vehicle.registration,
        vehicle.plateNumber,
        vehicle.make,
        vehicle.model,
        vehicle.vehicleType,
        vehicle.currentStatus,
        vehicle.currentDriver?.callsign,
        vehicle.currentDriver?.forename,
        vehicle.currentDriver?.surname,
      ].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [vehicles, search]);

  const suspended = vehicles.filter(
    (vehicle) => vehicle.isSuspended,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
            Operations
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            Fleet
          </h1>

          <p className="mt-3 text-slate-400">
            Active Autocab vehicles and current operational state.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncVehicles()}
            disabled={syncing || loading}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "Synchronizing…" : "Sync Vehicles Now"}
          </button>

          <button
            type="button"
            onClick={() => void loadVehicles()}
            disabled={loading || syncing}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Active Vehicles" value={vehicles.length} />
        <Metric label="Suspended" value={suspended} />
        <Metric
          label="With Driver"
          value={vehicles.filter((v) => v.currentDriver).length}
        />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search callsign, registration, driver..."
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading fleet…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Callsign</th>
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Registration</th>
                  <th className="px-5 py-3">Driver</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {filteredVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className="hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-4 font-semibold text-white">
                      {vehicle.callsign ?? "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {[vehicle.make, vehicle.model]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {vehicle.registration ??
                        vehicle.plateNumber ??
                        "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {driverName(vehicle)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-300">
                        {vehicle.currentStatus ??
                          (vehicle.isSuspended
                            ? "Suspended"
                            : "Unknown")}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      No vehicles found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}
