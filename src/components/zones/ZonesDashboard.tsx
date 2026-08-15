"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Zone = {
  id: string;
  externalId: string;
  companyId: number;
  mdtZoneId: number | null;
  name: string;
  descriptor: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  active: boolean;
  lastSyncedAt: string;
};

type ZonesResponse = {
  success: boolean;
  total?: number;
  zones?: Zone[];
  message?: string;
};

export default function ZonesDashboard() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        "/api/dashboard/zones",
        { cache: "no-store" },
      );

      const payload =
        (await response.json()) as ZonesResponse;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ?? "Zones could not be loaded.",
        );
      }

      setZones(payload.zones ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load zones.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadZones();
  }, [loadZones]);

  async function syncZones() {
    try {
      setSyncing(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        "/api/dashboard/integrations/autocab/zones/sync",
        {
          method: "POST",
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ?? "Zone sync failed.",
        );
      }

      const result = payload.result;

      setMessage(
        `Sync complete: ${result.eligible} active company 1 zones, ${result.created} created, ${result.updated} updated, ${result.disabled} disabled, ${result.failed} failed.`,
      );

      await loadZones();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sync zones.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const filteredZones = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return zones;
    }

    return zones.filter((zone) =>
      [
        zone.name,
        zone.descriptor ?? "",
        zone.externalId,
        zone.mdtZoneId?.toString() ?? "",
      ].some((field) =>
        field.toLowerCase().includes(value),
      ),
    );
  }, [zones, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
            Operations
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            Zones
          </h1>

          <p className="mt-3 text-slate-400">
            Active Autocab zones for company 1.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void syncZones()}
          disabled={syncing}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {syncing ? "Syncing Zones…" : "Sync Zones Now"}
        </button>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {zones.length} active zones
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Company ID 1 only
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search zones..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500 md:max-w-sm"
          />
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading zones…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Descriptor</th>
                  <th className="px-5 py-3">Autocab ID</th>
                  <th className="px-5 py-3">MDT Zone ID</th>
                  <th className="px-5 py-3">Centre</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {filteredZones.map((zone) => (
                  <tr
                    key={zone.id}
                    className="hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-4 font-semibold text-white">
                      {zone.name}
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      {zone.descriptor ?? "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {zone.externalId}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {zone.mdtZoneId ?? "—"}
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">
                      {zone.latitude !== null &&
                      zone.longitude !== null
                        ? `${zone.latitude}, ${zone.longitude}`
                        : "—"}
                    </td>
                  </tr>
                ))}

                {filteredZones.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      No zones found.
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
