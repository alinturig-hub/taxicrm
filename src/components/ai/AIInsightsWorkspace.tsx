"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type InsightData = {
  success: true;
  generatedAt: string;
  periodDays: number;
  overview: {
    state: "STABLE" | "ATTENTION";
    activeInsights: number;
    openAlerts: number;
  };
  demand: {
    windowStartAt: string;
    windowEndAt: string;
    predictedBookings: number;
    lowerBound: number;
    upperBound: number;
    observedSoFar: number;
    progressPercent: number;
    peakSlot: {
      startAt: string;
      endAt: string;
      predictedCount: number;
    } | null;
    slotTotal: number;
    totalsMatch: boolean;
  } | null;
  forecastEvidence: {
    live: {
      evaluated: number;
      averageErrorPercent: number | null;
      insideRange: number;
      rangeCoveragePercent: number | null;
      confidence: "LEARNING" | "MEASURED";
    };
    backtest: {
      evaluated: number;
      averageErrorPercent: number | null;
      insideRange: number;
      rangeCoveragePercent: number | null;
    };
  };
  customerPredictionEvidence: {
    evaluated: number;
    hits: number;
    hitRate: number | null;
    slotEvaluated: number;
    slotHits: number;
    slotHitRate: number | null;
    strongestLevel: {
      level: string;
      evaluated: number;
      hits: number;
      hitRate: number | null;
    } | null;
    weakestLevel: {
      level: string;
      evaluated: number;
      hits: number;
      hitRate: number | null;
    } | null;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    detectedAt: string;
    lastSeenAt: string;
  }>;
};

function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-GB",
  ).format(value);
}

function formatPercent(
  value: number | null,
) {
  return value === null
    ? "Learning"
    : `${value.toFixed(1)}%`;
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    },
  ).format(new Date(value));
}

function formatTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    },
  ).format(new Date(value));
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
    <article className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold text-white">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {detail}
      </p>
    </article>
  );
}

export default function AIInsightsWorkspace() {
  const [data, setData] =
    useState<InsightData | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/dashboard/ai/insights",
          {
            cache: "no-store",
          },
        );

        const payload =
          await response.json();

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            payload.message ??
              "Insights could not be loaded.",
          );
        }

        setData(
          payload as InsightData,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Insights could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-8 text-sm text-slate-400">
        Building verified insights…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <p className="font-semibold text-red-300">
          Insights unavailable
        </p>
        <p className="mt-2 text-sm text-red-200/70">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-200"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const demand = data.demand;
  const predictionEvidence =
    data.customerPredictionEvidence;
  const live =
    data.forecastEvidence.live;
  const backtest =
    data.forecastEvidence.backtest;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-500/20 bg-slate-900/70 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              AI Center
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
              Insights
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Operational conclusions generated only
              from measured booking demand, verified
              prediction outcomes and system alerts.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Updated{" "}
              {formatDateTime(
                data.generatedAt,
              )}{" "}
              · Europe/London
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={
                data.overview.state ===
                "STABLE"
                  ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300"
                  : "rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300"
              }
            >
              {data.overview.state}
            </span>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 disabled:opacity-50"
            >
              {loading
                ? "Refreshing…"
                : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Expected demand"
          value={
            demand
              ? formatNumber(
                  demand.predictedBookings,
                )
              : "—"
          }
          detail={
            demand
              ? `${formatNumber(
                  demand.lowerBound,
                )}–${formatNumber(
                  demand.upperBound,
                )} likely booking requests`
              : "No active 24-hour forecast"
          }
        />
        <MetricCard
          label="Observed so far"
          value={
            demand
              ? formatNumber(
                  demand.observedSoFar,
                )
              : "—"
          }
          detail={
            demand
              ? `${demand.progressPercent.toFixed(
                  1,
                )}% of the forecast window elapsed`
              : "Waiting for an active forecast"
          }
        />
        <MetricCard
          label="Live forecast error"
          value={formatPercent(
            live.averageErrorPercent,
          )}
          detail={`${live.evaluated} live forecast${
            live.evaluated === 1
              ? ""
              : "s"
          } verified · ${live.confidence}`}
        />
        <MetricCard
          label="Open alerts"
          value={String(
            data.overview.openAlerts,
          )}
          detail={
            data.overview.openAlerts === 0
              ? "No measured operational exception"
              : "Review exceptions below"
          }
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            Demand insight
          </p>
          <h2 className="mt-3 text-xl font-bold text-white">
            Peak three-hour interval
          </h2>

          {demand?.peakSlot ? (
            <>
              <p className="mt-5 text-3xl font-bold text-white">
                {formatNumber(
                  demand.peakSlot
                    .predictedCount,
                )}{" "}
                bookings
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {formatTime(
                  demand.peakSlot.startAt,
                )}{" "}
                –{" "}
                {formatTime(
                  demand.peakSlot.endAt,
                )}
              </p>
              <p className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm leading-6 text-slate-400">
                This is the highest expected demand
                interval inside the active forecast.
                It is an operational estimate, not a
                guaranteed booking total.
              </p>
            </>
          ) : (
            <p className="mt-5 text-sm text-slate-400">
              No active interval evidence.
            </p>
          )}

          {demand ? (
            <p
              className={
                demand.totalsMatch
                  ? "mt-4 text-xs font-semibold text-emerald-400"
                  : "mt-4 text-xs font-semibold text-red-400"
              }
            >
              {demand.totalsMatch
                ? "Slot totals reconcile with the 24-hour forecast."
                : "Slot totals do not reconcile; an alert is required."}
            </p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            Model evidence
          </p>
          <h2 className="mt-3 text-xl font-bold text-white">
            Forecast proof
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">
                Live verified
              </p>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatPercent(
                  live.averageErrorPercent,
                )}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Average error · {live.evaluated} evaluated
                · range coverage{" "}
                {formatPercent(
                  live.rangeCoveragePercent,
                )}
              </p>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <p className="text-sm font-semibold text-white">
                Historical backtest
              </p>
              <p className="mt-3 text-2xl font-bold text-white">
                {formatPercent(
                  backtest.averageErrorPercent,
                )}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Average error · {backtest.evaluated} evaluated
                · range coverage{" "}
                {formatPercent(
                  backtest.rangeCoveragePercent,
                )}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Live evidence and historical backtests are
            kept separate. Confidence becomes measured
            only after at least seven live outcomes.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Customer prediction evidence
        </p>
        <h2 className="mt-3 text-xl font-bold text-white">
          Verified outcomes over the last{" "}
          {data.periodDays} days
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="24-hour accuracy"
            value={formatPercent(
              predictionEvidence.hitRate,
            )}
            detail={`${formatNumber(
              predictionEvidence.hits,
            )} hits from ${formatNumber(
              predictionEvidence.evaluated,
            )} evaluated predictions`}
          />
          <MetricCard
            label="Three-hour accuracy"
            value={formatPercent(
              predictionEvidence.slotHitRate,
            )}
            detail={`${formatNumber(
              predictionEvidence.slotHits,
            )} correct intervals from ${formatNumber(
              predictionEvidence.slotEvaluated,
            )} evaluated`}
          />
          <MetricCard
            label="Strongest level"
            value={
              predictionEvidence
                .strongestLevel?.level ??
              "Learning"
            }
            detail={
              predictionEvidence
                .strongestLevel
                ? `${formatPercent(
                    predictionEvidence
                      .strongestLevel
                      .hitRate,
                  )} across ${formatNumber(
                    predictionEvidence
                      .strongestLevel
                      .evaluated,
                  )} outcomes`
                : "At least 20 outcomes are required"
            }
          />
          <MetricCard
            label="Weakest level"
            value={
              predictionEvidence
                .weakestLevel?.level ??
              "Learning"
            }
            detail={
              predictionEvidence
                .weakestLevel
                ? `${formatPercent(
                    predictionEvidence
                      .weakestLevel
                      .hitRate,
                  )} across ${formatNumber(
                    predictionEvidence
                      .weakestLevel
                      .evaluated,
                  )} outcomes`
                : "At least 20 outcomes are required"
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
          Exceptions
        </p>
        <h2 className="mt-3 text-xl font-bold text-white">
          Evidence requiring attention
        </h2>

        {data.alerts.length === 0 ? (
          <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="font-semibold text-emerald-300">
              No active exceptions
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Forecast execution, measured error and
              slot integrity are currently within the
              configured rules.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {data.alerts.map(
              (alert) => (
                <article
                  key={alert.id}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-amber-200">
                      {alert.type.replaceAll(
                        "_",
                        " ",
                      )}
                    </p>
                    <span className="rounded-full border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300">
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {alert.message}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Last observed{" "}
                    {formatDateTime(
                      alert.lastSeenAt,
                    )}
                  </p>
                </article>
              ),
            )}
          </div>
        )}
      </section>

      <p className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs leading-5 text-slate-500">
        These insights describe observed operational
        patterns. They do not prove customer intent,
        causation or protected personal characteristics,
        and they do not trigger customer contact.
      </p>
    </div>
  );
}
