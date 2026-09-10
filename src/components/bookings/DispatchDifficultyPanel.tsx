"use client";

import {
  useEffect,
  useState,
} from "react";

type DispatchJob = {
  bookingId: string;
  rawDispatchAttempts: number;
  rawRejectionAttempts: number;
  uniqueRejectingDrivers: number;
  effectiveDriverRejections: number;
  recoveredDriverRejections: number;
  secondsFromFirstDispatchToAcceptance:
    number | null;
  finalOutcome: string;
  secondsFromLastRejectionToCancellation:
    number | null;
  minutesFromFirstDispatchToPickup:
    number | null;
  typeOfBooking: string | null;
  bookingSource: string | null;
  pickupZone: string | null;
  estimatedValue: number;
};

type DifficultyBucket = {
  bucket: string;
  jobs: number;
  cancelledJobs: number;
  cancellationRate: number;
  acceptedJobs: number;
  averageSecondsToAcceptance:
    number | null;
};

type DifficultyResponse = {
  success: boolean;
  summary?: {
    affectedJobs: number;
    effectiveDriverRejections: number;
    recoveredBySameDriver: number;
    cancelledAfterRejection: number;
    noFareAfterRejection: number;
    cancellationRateAfterRejection: number;
    averageSecondsToAcceptance:
      number | null;
  };
  buckets?: DifficultyBucket[];
  jobs?: DispatchJob[];
  message?: string;
  error?: string;
};

function duration(
  seconds: number | null,
) {
  if (seconds === null) {
    return "—";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    return `${Math.round(
      seconds / 60,
    )}m`;
  }

  const hours =
    Math.floor(
      seconds / 3600,
    );

  const minutes =
    Math.round(
      (
        seconds %
        3600
      ) /
        60,
    );

  return `${hours}h ${minutes}m`;
}

function outcomeStyle(
  outcome: string,
) {
  if (outcome === "COMPLETED") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (outcome === "CANCELLED") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (outcome === "NO_FARE") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

export default function DispatchDifficultyPanel({
  fromDate,
  toDate,
  onOpenBooking,
}: {
  fromDate: string;
  toDate: string;
  onOpenBooking:
    (bookingId: string) =>
      void;
}) {
  const [
    data,
    setData,
  ] =
    useState<DifficultyResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const params =
          new URLSearchParams({
            page: "1",
            pageSize: "50",
          });

        if (fromDate) {
          params.set(
            "from",
            fromDate,
          );
        }

        if (toDate) {
          params.set(
            "to",
            toDate,
          );
        }

        const response =
          await fetch(
            `/api/bookings/dispatch-difficulty?${params.toString()}`,
            {
              cache:
                "no-store",
            },
          );

        const payload =
          await response.json() as
            DifficultyResponse;

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            payload.message ??
            payload.error ??
            "Dispatch difficulty could not be loaded.",
          );
        }

        if (!cancelled) {
          setData(
            payload,
          );
        }
      } catch (
        loadError
      ) {
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Dispatch difficulty could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled =
        true;
    };
  }, [
    fromDate,
    toDate,
  ]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
        Loading dispatch difficulty…
      </section>
    );
  }

  if (
    error ||
    !data?.summary
  ) {
    return (
      <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center text-sm text-red-300">
        {error ??
          "Dispatch difficulty is unavailable."}
      </section>
    );
  }

  const summary =
    data.summary;

  const metrics = [
    {
      label:
        "Affected jobs",
      value:
        summary.affectedJobs.toLocaleString(
          "en-GB",
        ),
      detail:
        "Rejected at least once",
    },
    {
      label:
        "Effective rejections",
      value:
        summary.effectiveDriverRejections.toLocaleString(
          "en-GB",
        ),
      detail:
        "Unique job and driver pairs",
    },
    {
      label:
        "Recovered",
      value:
        summary.recoveredBySameDriver.toLocaleString(
          "en-GB",
        ),
      detail:
        "Same driver later accepted",
    },
    {
      label:
        "Cancelled afterwards",
      value:
        summary.cancelledAfterRejection.toLocaleString(
          "en-GB",
        ),
      detail:
        "Observed final outcome",
    },
    {
      label:
        "No Fare / No Show afterwards",
      value:
        summary.noFareAfterRejection.toLocaleString(
          "en-GB",
        ),
      detail:
        "Observed final outcome",
    },
    {
      label:
        "Cancellation rate",
      value:
        `${summary.cancellationRateAfterRejection.toFixed(
          2,
        )}%`,
      detail:
        "Among affected jobs",
    },
    {
      label:
        "Average acceptance time",
      value:
        duration(
          summary.averageSecondsToAcceptance,
        ),
      detail:
        "From first dispatch",
    },
  ];

  return (
    <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">
          Dispatch Difficulty
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Descriptive evidence showing how difficult jobs were to allocate. Rejections affect driver operational KPIs, not customers.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(
          (metric) => (
            <div
              key={
                metric.label
              }
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {metric.label}
              </p>

              <p className="mt-2 text-2xl font-bold text-white">
                {metric.value}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {metric.detail}
              </p>
            </div>
          ),
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            Outcomes by effective rejection count
          </h3>
        </div>

        <div className="grid gap-px bg-slate-800 sm:grid-cols-2 xl:grid-cols-4">
          {(data.buckets ?? []).map(
            (bucket) => (
              <div
                key={
                  bucket.bucket
                }
                className="bg-slate-950 p-4"
              >
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  {
                    bucket.bucket
                  }{" "}
                  rejection
                  {bucket.bucket ===
                  "1"
                    ? ""
                    : "s"}
                </p>

                <p className="mt-2 text-xl font-bold text-white">
                  {bucket.jobs.toLocaleString(
                    "en-GB",
                  )}{" "}
                  jobs
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {bucket.cancelledJobs.toLocaleString(
                    "en-GB",
                  )}{" "}
                  cancelled ·{" "}
                  {bucket.cancellationRate.toFixed(
                    2,
                  )}
                  %
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Average acceptance:{" "}
                  {duration(
                    bucket.averageSecondsToAcceptance,
                  )}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">
            Highest allocation difficulty
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  Job
                </th>
                <th className="px-4 py-3 text-right">
                  Effective rejects
                </th>
                <th className="px-4 py-3 text-right">
                  Dispatch attempts
                </th>
                <th className="px-4 py-3">
                  Acceptance time
                </th>
                <th className="px-4 py-3">
                  Pickup lead
                </th>
                <th className="px-4 py-3">
                  Zone
                </th>
                <th className="px-4 py-3">
                  Type
                </th>
                <th className="px-4 py-3">
                  Outcome
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {(data.jobs ?? []).map(
                (job) => (
                  <tr
                    key={
                      job.bookingId
                    }
                    className="hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenBooking(
                            job.bookingId,
                          )
                        }
                        className="font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {
                          job.bookingId
                        }
                      </button>
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-white">
                      {
                        job.effectiveDriverRejections
                      }
                    </td>

                    <td className="px-4 py-3 text-right text-slate-300">
                      {
                        job.rawDispatchAttempts
                      }
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {duration(
                        job.secondsFromFirstDispatchToAcceptance,
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {job.minutesFromFirstDispatchToPickup ===
                      null
                        ? "—"
                        : `${job.minutesFromFirstDispatchToPickup.toFixed(
                            1,
                          )}m`}
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {job.pickupZone ??
                        "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {job.typeOfBooking ??
                        "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full border px-2.5 py-1 text-xs font-semibold",
                          outcomeStyle(
                            job.finalOutcome,
                          ),
                        ].join(
                          " ",
                        )}
                      >
                        {
                          job.finalOutcome
                        }
                      </span>
                    </td>
                  </tr>
                ),
              )}

              {(data.jobs ?? [])
                .length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No rejected jobs were recorded in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        This section shows observed operational relationships. It does not establish that driver rejection caused cancellation and it does not affect customer scoring.
      </p>
    </section>
  );
}
