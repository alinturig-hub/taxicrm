"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type HealthLevel =
  | "HEALTHY"
  | "WARNING"
  | "CRITICAL"
  | "WAITING";

type JobRun = {
  id: string;
  jobKey: string;
  status: string;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  selected: number;
  processed: number;
  succeeded: number;
  failed: number;
  hasMore: boolean | null;
  message: string | null;
  error: string | null;
};

type DemandAlert = {
  id: string;
  alertKey: string;
  type: string;
  severity: string;
  status: string;
  forecastId: string | null;
  message: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
};

type HealthResponse = {
  success: boolean;
  containsPersonalData: boolean;
  generatedAt: string;
  overallStatus: HealthLevel;
  jobs: {
    predictions: {
      status: HealthLevel;
      lastRun: JobRun | null;
      lastCalculatedAt: string | null;
      minutesSinceActivity: number | null;
      staleAfterMinutes: number;
      failedProfiles: number;
    };
    demandForecast: {
      status: HealthLevel;
      lastRun: JobRun | null;
      minutesSinceRun: number | null;
      staleAfterMinutes: number;
      active: {
        id: string;
        issuedAt: string;
        windowStartAt: string;
        windowEndAt: string;
        predictedCount: number;
        lowerBound: number;
        upperBound: number;
        observedSoFar: number;
        calibrationDays: number;
        backtestMape: number;
        slotTotal: number;
        slotTotalsMatch: boolean;
      } | null;
      alerts: {
        open: number;
        critical: number;
        warning: number;
        current: DemandAlert[];
        recent: DemandAlert[];
      };
      rangeEvidence: {
        historical: {
          evaluated: number;
          insideRange: number;
          coverageRate: number | null;
        };
        live: {
          evaluated: number;
          insideRange: number;
          coverageRate: number | null;
        };
      };
    };
    snapshots: {
      status: HealthLevel;
      lastRun: JobRun | null;
      latestGeneratedAt: string | null;
      completedToday: number;
      eligibleActiveCustomers: number;
      expectedAfterLondonHour: number;
    };
    geoapify: {
      status: HealthLevel;
      lastRun: JobRun | null;
      lastSuccessfulLookupAt: string | null;
      lastError: string | null;
      enabled: boolean;
    };
  };
  recentJobRuns: JobRun[];
  intelligenceStates: {
    dirty: number;
    current: number;
    failed: number;
  };
  predictions: {
    modelVersion: string;
    horizonHours: number;
    pending: number;
    hit: number;
    missed: number;
    latestActivityAt: string | null;
    accuracyPeriodDays: number;
    evaluated: number;
    hitRate: number | null;
    timeSlotEvaluated: number;
    timeSlotHitRate: number | null;
    averageTimeSlotMissMinutes: number | null;
  };
  geoapify: {
    dailyUsed: number;
    dailyLimit: number;
    creditsRemaining: number;
    backfillCeiling: number;
    backfillCreditsRemaining: number;
    historicalLocations: number;
    readyHistoricalLocations: number;
    waitingHistoricalLocations: number;
    protectedHistoricalLocations: number;
    coveragePercent: number | null;
  };
};

const dateFormatter =
  new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      dateStyle: "medium",
      timeStyle: "short",
    },
  );

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "No activity recorded";
  }

  return dateFormatter.format(
    new Date(value),
  );
}

function formatPercent(
  value: number | null,
) {
  return value === null
    ? "Learning"
    : `${value.toFixed(1)}%`;
}

function alertEvidence(
  alert: DemandAlert,
) {
  const expected =
    Number(
      alert.evidence.predictedCount,
    );
  const actual =
    Number(
      alert.evidence.actualCount,
    );
  const lower =
    Number(
      alert.evidence.lowerBound,
    );
  const upper =
    Number(
      alert.evidence.upperBound,
    );
  const error =
    Number(
      alert.evidence.percentageError,
    );
  const slotTotal =
    Number(
      alert.evidence.slotTotal,
    );

  const parts: string[] = [];

  if (Number.isFinite(expected)) {
    parts.push(
      `Expected ${expected}`,
    );
  }

  if (Number.isFinite(actual)) {
    parts.push(
      `Actual ${actual}`,
    );
  }

  if (
    Number.isFinite(lower) &&
    Number.isFinite(upper)
  ) {
    parts.push(
      `Range ${lower}–${upper}`,
    );
  }

  if (Number.isFinite(error)) {
    parts.push(
      `Error ${error.toFixed(1)}%`,
    );
  }

  if (Number.isFinite(slotTotal)) {
    parts.push(
      `Slot total ${slotTotal}`,
    );
  }

  return parts.length > 0
    ? parts.join(" · ")
    : "Operational check recorded";
}

function formatDuration(
  value: number | null,
) {
  if (value === null) {
    return "Running";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  if (value < 60_000) {
    return `${(value / 1000).toFixed(1)} sec`;
  }

  return `${(value / 60_000).toFixed(1)} min`;
}

function jobLabel(jobKey: string) {
  if (
    jobKey ===
    "CUSTOMER_BOOKING_PREDICTIONS"
  ) {
    return "Booking predictions";
  }

  if (
    jobKey ===
    "BOOKING_DEMAND_FORECAST"
  ) {
    return "Booking demand forecast";
  }

  if (
    jobKey ===
    "CUSTOMER_PROFILE_SNAPSHOTS"
  ) {
    return "Profile snapshots";
  }

  if (
    jobKey ===
    "HISTORICAL_GEOAPIFY_BACKFILL"
  ) {
    return "Historical Geoapify";
  }

  return jobKey;
}

function jobStatusLevel(
  status: string,
): HealthLevel {
  if (status === "SUCCEEDED") {
    return "HEALTHY";
  }

  if (status === "FAILED") {
    return "CRITICAL";
  }

  return "WAITING";
}

function statusClasses(
  status: HealthLevel,
) {
  if (status === "HEALTHY") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "CRITICAL") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }

  if (status === "WARNING") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

export default function CustomerIntelligenceHealthDashboard() {
  const [health, setHealth] =
    useState<HealthResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const loadHealth = useCallback(
    async () => {
      try {
        setError(null);

        const response = await fetch(
          "/api/dashboard/configuration/system-health",
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as
            HealthResponse & {
              message?: string;
            };

        if (!response.ok || !payload.success) {
          throw new Error(
            payload.message ??
              "System health could not be loaded.",
          );
        }

        setHealth(payload);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "System health could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadHealth();

    const interval = window.setInterval(
      () => {
        void loadHealth();
      },
      60_000,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [loadHealth]);

  if (loading && !health) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-sm text-slate-400">
        Loading customer intelligence health…
      </div>
    );
  }

  if (!health) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
        <p className="font-semibold text-rose-300">
          System health is unavailable
        </p>
        <p className="mt-2 text-sm text-rose-200/70">
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadHealth();
          }}
          className="mt-4 rounded-lg border border-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-200"
        >
          Try again
        </button>
      </div>
    );
  }

  const recentJobRuns =
    Array.isArray(
      health.recentJobRuns,
    )
      ? health.recentJobRuns
      : [];

  const jobCards = [
    {
      title: "Booking predictions",
      status:
        health.jobs.predictions.status,
      primary:
        health.jobs.predictions
          .minutesSinceActivity === null
          ? "No activity"
          : `${health.jobs.predictions.minutesSinceActivity} min ago`,
      secondary:
        `${health.jobs.predictions.failedProfiles} failed profiles`,
      lastActivity:
        health.jobs.predictions
          .lastCalculatedAt,
    },
    {
      title: "Booking demand forecast",
      status:
        health.jobs.demandForecast.status,
      primary:
        health.jobs.demandForecast.active
          ? `${health.jobs.demandForecast.active.predictedCount} expected`
          : "No active forecast",
      secondary:
        health.jobs.demandForecast.active
          ? `${health.jobs.demandForecast.active.lowerBound}–${health.jobs.demandForecast.active.upperBound} expected range`
          : "A current 24-hour forecast is required",
      lastActivity:
        health.jobs.demandForecast.lastRun
          ?.startedAt ?? null,
    },
    {
      title: "Daily snapshots",
      status:
        health.jobs.snapshots.status,
      primary:
        `${health.jobs.snapshots.completedToday} completed today`,
      secondary:
        `${health.jobs.snapshots.eligibleActiveCustomers} active profiles`,
      lastActivity:
        health.jobs.snapshots
          .latestGeneratedAt,
    },
    {
      title: "Geoapify enrichment",
      status:
        health.jobs.geoapify.status,
      primary:
        health.jobs.geoapify.enabled
          ? "Integration enabled"
          : "Integration disabled",
      secondary:
        health.jobs.geoapify.lastError
          ? "Latest lookup reported an error"
          : "No current provider error",
      lastActivity:
        health.jobs.geoapify
          .lastSuccessfulLookupAt,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              Customer Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
              System Health
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Live operational health for predictions,
              profile snapshots and place enrichment.
              Aggregate metrics only; no customer contact
              details or protected locations are exposed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusClasses(
                health.overallStatus,
              )}`}
            >
              {health.overallStatus}
            </span>
            <button
              type="button"
              onClick={() => void loadHealth()}
              disabled={loading}
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
            >
              {loading
                ? "Refreshing…"
                : "Refresh"}
            </button>
          </div>
        </div>

        <p className="mt-5 text-xs text-slate-500">
          Updated {formatDate(health.generatedAt)}
          {" · "}Automatically refreshes every minute
        </p>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Latest refresh failed: {error}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {jobCards.map((job) => (
          <article
            key={job.title}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-semibold text-white">
                {job.title}
              </h2>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                  job.status,
                )}`}
              >
                {job.status}
              </span>
            </div>
            <p className="mt-5 text-2xl font-bold text-white">
              {job.primary}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {job.secondary}
            </p>
            <p className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-500">
              Last activity:{" "}
              {formatDate(job.lastActivity)}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-blue-500/20 bg-slate-900 p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              Booking demand evidence
            </p>
            <h2 className="mt-2 text-xl font-bold text-white">
              Realistic 24-hour volume forecast
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              One forecast for unique booking requests.
              Individual customer signals are not added
              together. Range coverage is measured from
              completed forecasts.
            </p>
          </div>
          <span
            className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
              health.jobs.demandForecast.status,
            )}`}
          >
            {health.jobs.demandForecast.status}
          </span>
        </div>

        {health.jobs.demandForecast.active ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Central estimate"
                value={String(
                  health.jobs.demandForecast
                    .active.predictedCount,
                )}
                detail="Unique booking requests expected"
              />
              <MetricCard
                label="Expected range"
                value={`${health.jobs.demandForecast.active.lowerBound}–${health.jobs.demandForecast.active.upperBound}`}
                detail="Supported by measured historical errors"
              />
              <MetricCard
                label="Observed so far"
                value={String(
                  health.jobs.demandForecast
                    .active.observedSoFar,
                )}
                detail={`Window ends ${formatDate(
                  health.jobs.demandForecast
                    .active.windowEndAt,
                )}`}
              />
              <MetricCard
                label="Backtest error"
                value={formatPercent(
                  health.jobs.demandForecast
                    .active.backtestMape,
                )}
                detail={`${health.jobs.demandForecast.active.calibrationDays} complete calibration days`}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Historical range coverage
                </p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {formatPercent(
                    health.jobs.demandForecast
                      .rangeEvidence.historical
                      .coverageRate,
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {
                    health.jobs.demandForecast
                      .rangeEvidence.historical
                      .insideRange
                  }{" "}
                  of{" "}
                  {
                    health.jobs.demandForecast
                      .rangeEvidence.historical
                      .evaluated
                  }{" "}
                  completed backtests finished inside
                  their stated range.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Live verified range coverage
                </p>
                <p className="mt-3 text-2xl font-bold text-white">
                  {formatPercent(
                    health.jobs.demandForecast
                      .rangeEvidence.live
                      .coverageRate,
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {
                    health.jobs.demandForecast
                      .rangeEvidence.live
                      .insideRange
                  }{" "}
                  of{" "}
                  {
                    health.jobs.demandForecast
                      .rangeEvidence.live
                      .evaluated
                  }{" "}
                  completed live forecasts finished
                  inside their stated range.
                </p>
              </div>
            </div>

            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                health.jobs.demandForecast
                  .active.slotTotalsMatch
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-200"
              }`}
            >
              {health.jobs.demandForecast
                .active.slotTotalsMatch
                ? `Verified: all three-hour slots total ${health.jobs.demandForecast.active.slotTotal}, matching the central forecast.`
                : "Forecast integrity warning: interval totals do not match the central estimate."}
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/30 p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Demand alerts
                  </p>
                  <h3 className="mt-2 font-semibold text-white">
                    Active operational exceptions
                  </h3>
                </div>
                <p className="text-sm text-slate-400">
                  {
                    health.jobs.demandForecast
                      .alerts.open
                  }{" "}
                  open ·{" "}
                  {
                    health.jobs.demandForecast
                      .alerts.critical
                  }{" "}
                  critical ·{" "}
                  {
                    health.jobs.demandForecast
                      .alerts.warning
                  }{" "}
                  warning
                </p>
              </div>

              {health.jobs.demandForecast
                .alerts.current.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {health.jobs.demandForecast
                    .alerts.current.map(
                      (alert) => (
                        <article
                          key={alert.id}
                          className={`rounded-lg border p-4 ${
                            alert.severity ===
                            "CRITICAL"
                              ? "border-rose-500/30 bg-rose-500/10"
                              : "border-amber-500/30 bg-amber-500/10"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="font-semibold text-white">
                              {alert.type
                                .split("_")
                                .map(
                                  (word) =>
                                    word.charAt(0) +
                                    word
                                      .slice(1)
                                      .toLowerCase(),
                                )
                                .join(" ")}
                            </p>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                alert.severity ===
                                "CRITICAL"
                                  ? "border-rose-400/30 text-rose-300"
                                  : "border-amber-400/30 text-amber-300"
                              }`}
                            >
                              {alert.severity}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">
                            {alert.message}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {alertEvidence(
                              alert,
                            )}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            Detected{" "}
                            {formatDate(
                              alert.detectedAt,
                            )}
                          </p>
                        </article>
                      ),
                    )}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
                  No active booking-demand alerts.
                </div>
              )}

              {health.jobs.demandForecast
                .alerts.recent.some(
                  (alert) =>
                    alert.status ===
                    "RESOLVED",
                ) ? (
                <div className="mt-5 border-t border-slate-800 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Recently resolved
                  </p>
                  <div className="mt-3 space-y-2">
                    {health.jobs.demandForecast
                      .alerts.recent
                      .filter(
                        (alert) =>
                          alert.status ===
                          "RESOLVED",
                      )
                      .slice(0, 5)
                      .map((alert) => (
                        <div
                          key={alert.id}
                          className="flex flex-col justify-between gap-1 rounded-lg border border-slate-800 px-3 py-2 text-sm sm:flex-row"
                        >
                          <span className="text-slate-300">
                            {alert.type
                              .split("_")
                              .join(" ")}
                          </span>
                          <span className="text-xs text-slate-500">
                            Resolved{" "}
                            {formatDate(
                              alert.resolvedAt,
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">
            No active booking-demand forecast exists.
          </div>
        )}

        <p className="mt-4 text-xs leading-5 text-slate-500">
          The range is not a guarantee. Historical and
          live coverage are shown separately so an early
          model cannot present backtesting as live proof.
          Job health becomes late after{" "}
          {
            health.jobs.demandForecast
              .staleAfterMinutes
          }{" "}
          minutes without a run.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
            Execution ledger
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">
            Recent automated jobs
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Exact execution status, duration and
            aggregate processing totals. Errors are
            redacted before storage.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="px-3 py-3 font-semibold">
                  Job
                </th>
                <th className="px-3 py-3 font-semibold">
                  Status
                </th>
                <th className="px-3 py-3 font-semibold">
                  Started
                </th>
                <th className="px-3 py-3 font-semibold">
                  Duration
                </th>
                <th className="px-3 py-3 font-semibold">
                  Processed
                </th>
                <th className="px-3 py-3 font-semibold">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {recentJobRuns
                .slice(0, 12)
                .map((run) => (
                  <tr key={run.id}>
                    <td className="whitespace-nowrap px-3 py-4">
                      <p className="font-semibold text-white">
                        {jobLabel(run.jobKey)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {run.source}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                          jobStatusLevel(
                            run.status,
                          ),
                        )}`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-300">
                      {formatDate(
                        run.startedAt,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-300">
                      {formatDuration(
                        run.durationMs,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-300">
                      {run.processed} /{" "}
                      {run.selected}
                    </td>
                    <td className="min-w-[220px] px-3 py-4">
                      <p className="text-emerald-300">
                        {run.succeeded} succeeded
                      </p>
                      <p
                        className={
                          run.failed > 0
                            ? "mt-1 text-rose-300"
                            : "mt-1 text-slate-500"
                        }
                      >
                        {run.failed} failed
                      </p>
                      {run.error ? (
                        <p className="mt-2 text-xs text-rose-300/80">
                          {run.error}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {recentJobRuns.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No automated job executions have been
              recorded yet.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Prediction states"
          value={`${health.intelligenceStates.current} current`}
          detail={`${health.intelligenceStates.dirty} dirty · ${health.intelligenceStates.failed} failed`}
        />
        <MetricCard
          label="Prediction outcomes"
          value={`${health.predictions.hit} hit`}
          detail={`${health.predictions.pending} pending · ${health.predictions.missed} missed`}
        />
        <MetricCard
          label="24-hour accuracy"
          value={formatPercent(
            health.predictions.hitRate,
          )}
          detail={`${health.predictions.evaluated} evaluated over ${health.predictions.accuracyPeriodDays} days`}
        />
        <MetricCard
          label="3-hour slot accuracy"
          value={formatPercent(
            health.predictions
              .timeSlotHitRate,
          )}
          detail={`${health.predictions.timeSlotEvaluated} evaluated slots`}
        />
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-xl font-bold text-white">
              Historical place enrichment
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Controlled Geoapify coverage with a
              reserved allowance for new bookings.
            </p>
          </div>
          <p className="text-3xl font-bold text-white">
            {formatPercent(
              health.geoapify.coveragePercent,
            )}
          </p>
        </div>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
            style={{
              width: `${
                health.geoapify
                  .coveragePercent ?? 0
              }%`,
            }}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Ready locations"
            value={String(
              health.geoapify
                .readyHistoricalLocations,
            )}
            detail={`${health.geoapify.historicalLocations} total historical locations`}
          />
          <MetricCard
            label="Waiting locations"
            value={String(
              health.geoapify
                .waitingHistoricalLocations,
            )}
            detail={`${health.geoapify.protectedHistoricalLocations} protected locations`}
          />
          <MetricCard
            label="Credits today"
            value={`${health.geoapify.dailyUsed} / ${health.geoapify.dailyLimit}`}
            detail={`${health.geoapify.creditsRemaining} provider credits remaining`}
          />
          <MetricCard
            label="Backfill allowance"
            value={String(
              health.geoapify
                .backfillCreditsRemaining,
            )}
            detail={`Stops at ${health.geoapify.backfillCeiling} daily credits`}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-sm leading-6 text-slate-300">
        Prediction accuracy is observational and
        operational. It does not prove customer intent
        and must not be used to infer protected traits or
        automatically contact a customer.
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/40 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </article>
  );
}
