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

type HealthResponse = {
  success: boolean;
  containsPersonalData: boolean;
  generatedAt: string;
  overallStatus: HealthLevel;
  jobs: {
    predictions: {
      status: HealthLevel;
      lastCalculatedAt: string | null;
      minutesSinceActivity: number | null;
      staleAfterMinutes: number;
      failedProfiles: number;
    };
    snapshots: {
      status: HealthLevel;
      latestGeneratedAt: string | null;
      completedToday: number;
      eligibleActiveCustomers: number;
      expectedAfterLondonHour: number;
    };
    geoapify: {
      status: HealthLevel;
      lastSuccessfulLookupAt: string | null;
      lastError: string | null;
      enabled: boolean;
    };
  };
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

      <section className="grid gap-4 lg:grid-cols-3">
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
