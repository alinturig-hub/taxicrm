"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Statistics = {
  cachedPlaces: number;
  readyPlaces: number;
  sensitivePlaces: number;
  enrichedLocations: number;
  waitingDestinations: number;
};

type ResponsePayload = {
  success: boolean;
  message?: string;
  completed?: number;
  failed?: number;
  statistics?: Statistics;
};

export default function GeoapifyEnrichmentPanel() {
  const [statistics, setStatistics] =
    useState<Statistics | null>(null);
  const [batchLimit, setBatchLimit] =
    useState(1);
  const [processing, setProcessing] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  const loadStatistics =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/dashboard/integrations/geoapify/enrich",
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as ResponsePayload;

        if (
          !response.ok ||
          !payload.success ||
          !payload.statistics
        ) {
          throw new Error(
            payload.message ??
              "Statistics could not be loaded.",
          );
        }

        setStatistics(payload.statistics);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Statistics could not be loaded.",
        );
      }
    }, []);

  useEffect(() => {
    void loadStatistics();
  }, [loadStatistics]);

  async function processDestinations() {
    setProcessing(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        "/api/dashboard/integrations/geoapify/enrich",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            limit: batchLimit,
          }),
        },
      );

      const payload =
        (await response.json()) as ResponsePayload;

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message ??
            "Destinations could not be processed.",
        );
      }

      setMessage(
        `${payload.completed ?? 0} processed, ${payload.failed ?? 0} failed. Successful results are permanently cached.`,
      );

      await loadStatistics();
    } catch (processError) {
      setError(
        processError instanceof Error
          ? processError.message
          : "Destinations could not be processed.",
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h2 className="font-semibold text-white">
            Destination enrichment
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Identify real-world destinations. Previously identified
            coordinates are loaded from the permanent cache without
            using another API credit.
          </p>
        </div>

        <span className="w-fit rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300">
          Powered by Geoapify
        </span>
      </div>

      {message ? (
        <p className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Cached places"
          value={statistics?.cachedPlaces ?? 0}
        />
        <Metric
          label="Ready places"
          value={statistics?.readyPlaces ?? 0}
        />
        <Metric
          label="Linked locations"
          value={statistics?.enrichedLocations ?? 0}
        />
        <Metric
          label="Sensitive places"
          value={statistics?.sensitivePlaces ?? 0}
        />
        <Metric
          label="Waiting destinations"
          value={statistics?.waitingDestinations ?? 0}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="geoapify-batch"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Destinations per batch
          </label>

          <select
            id="geoapify-batch"
            value={batchLimit}
            onChange={(event) =>
              setBatchLimit(
                Number(event.target.value),
              )
            }
            className="mt-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value={1}>1 — safe test</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() =>
            void processDestinations()
          }
          disabled={processing}
          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
        >
          {processing
            ? "Identifying places…"
            : "Identify next destinations"}
        </button>

        <button
          type="button"
          onClick={() =>
            void loadStatistics()
          }
          disabled={processing}
          className="rounded-xl border border-slate-700 bg-slate-950 px-5 py-3 font-semibold text-white transition hover:border-blue-500 disabled:opacity-40"
        >
          Refresh statistics
        </button>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Sensitive locations are marked internally and excluded
        from personalised persuasion and customer-facing messages.
      </p>
    </section>
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
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold text-white">
        {value.toLocaleString("en-GB")}
      </p>
    </div>
  );
}
