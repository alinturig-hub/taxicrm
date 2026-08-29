"use client";

import {
  useEffect,
  useState,
} from "react";

type DashboardData = {
  success: boolean;
  message?: string;
  demandForecast?: {
    id: string;
    modelVersion: string;
    status: string;
    issuedAt: string;
    windowStartAt: string;
    windowEndAt: string;
    predictedBookings: number;
    lowerBound: number;
    upperBound: number;
    observedSoFar: number;
    calibrationDays: number;
    backtestMae: number;
    backtestMape: number;
    confidence: string;
    slots: Array<{
      startAt: string;
      endAt: string;
      predictedCount: number;
    }>;
  } | null;
  demandHistory?: Array<{
    id: string;
    issuedAt: string;
    windowStartAt: string;
    windowEndAt: string;
    predictedBookings: number;
    actualBookings: number | null;
    absoluteError: number | null;
    percentageError: number | null;
    source:
      | "HISTORICAL_BACKTEST"
      | "LIVE_VERIFIED";
  }>;
  summary?: {
    pending: number;
    evaluated: number;
    hitRate: number | null;
    slotHits: number;
    slotHitRate: number | null;
    averageSlotMissMinutes:
      number | null;
  };
  performanceByLevel?: Array<{
    level: string;
    evaluated: number;
    hits: number;
    missed: number;
    hitRate: number | null;
    slotHitRate: number | null;
  }>;
  opportunities?: Array<{
    predictionId: string;
    customerId: string;
    customerName: string | null;
    windowEndAt: string;
    likelyWindowStartAt:
      string | null;
    likelyWindowEndAt:
      string | null;
    score: number;
    level: string;
    observedRate: number;
    evidenceConfidence: number;
  }>;
};

const slotStartFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const timeFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const dateFormatter =
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  });

function timeSlot(
  startAt: string | null,
  endAt: string | null,
) {
  if (!startAt || !endAt) {
    return "No reliable slot";
  }

  return `${slotStartFormatter.format(
    new Date(startAt),
  )}–${timeFormatter.format(
    new Date(endAt),
  )}`;
}

function levelStyle(level: string) {
  if (level === "HIGH") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }

  if (level === "ELEVATED") {
    return "border-blue-400/30 bg-blue-400/10 text-blue-200";
  }

  if (level === "MODERATE") {
    return "border-violet-400/30 bg-violet-400/10 text-violet-200";
  }

  return "border-slate-600 bg-slate-800 text-slate-300";
}

export default function CustomerPredictionsDashboard({
  onOpenCustomer,
}: {
  onOpenCustomer: (
    customerId: string,
  ) => void;
}) {
  const [days, setDays] =
    useState<7 | 14 | 30>(7);
  const [data, setData] =
    useState<DashboardData | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/dashboard/customers/predictions?days=${days}`,
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as
            DashboardData;

        if (
          !response.ok ||
          !payload.success
        ) {
          throw new Error(
            payload.message ??
              "Predictions could not be loaded.",
          );
        }

        if (active) {
          setData(payload);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Predictions could not be loaded.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [days]);

  if (loading && !data) {
    return (
      <div className="p-10 text-center text-slate-500">
        Loading booking predictions…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="m-5 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-red-300">
        {error}
      </div>
    );
  }

  const summary = data?.summary;
  const opportunities =
    data?.opportunities ?? [];
  const demandForecast =
    data?.demandForecast ?? null;
  const demandHistory =
    data?.demandHistory ?? [];

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Booking Predictions
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Live 24-hour signals and verified
            3-hour timing accuracy.
          </p>
        </div>

        <div className="flex gap-2">
          {([7, 14, 30] as const).map(
            (value) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setDays(value)
                }
                className={[
                  "rounded-lg border px-3 py-2 text-sm font-semibold",
                  days === value
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-700 bg-slate-950 text-slate-300",
                ].join(" ")}
              >
                {value} days
              </button>
            ),
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-slate-950 to-slate-950">
        <div className="border-b border-slate-800 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                Booking demand forecast
              </p>
              <h3 className="mt-2 text-xl font-bold text-white">
                Unique booking requests expected in the next 24 hours
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                One operational volume forecast.
                Customer signals are not added together.
              </p>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              {demandForecast?.confidence ??
                "LEARNING"}
            </span>
          </div>
        </div>

        {demandForecast ? (
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Predicted bookings"
                value={String(
                  demandForecast
                    .predictedBookings,
                )}
                detail="Unique Booking IDs expected"
              />
              <Metric
                label="Expected range"
                value={`${demandForecast.lowerBound}–${demandForecast.upperBound}`}
                detail="80% historical error band"
              />
              <Metric
                label="Observed so far"
                value={String(
                  demandForecast
                    .observedSoFar,
                )}
                detail="Inside the active forecast window"
              />
              <Metric
                label="Backtest error"
                value={`${demandForecast.backtestMape}%`}
                detail={`${demandForecast.calibrationDays} complete calibration days`}
              />
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  Three-hour demand intervals
                </p>
                <p className="text-xs text-slate-500">
                  {dateFormatter.format(
                    new Date(
                      demandForecast
                        .windowStartAt,
                    ),
                  )}{" "}
                  →{" "}
                  {dateFormatter.format(
                    new Date(
                      demandForecast
                        .windowEndAt,
                    ),
                  )}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {demandForecast.slots.map(
                  (slot) => (
                    <div
                      key={slot.startAt}
                      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <p className="text-xs text-slate-500">
                        {timeSlot(
                          slot.startAt,
                          slot.endAt,
                        )}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-white">
                        {
                          slot.predictedCount
                        }
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        predicted bookings
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">
            The first demand forecast is
            being prepared.
          </div>
        )}
      </section>

      {demandHistory.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-800">
          <div className="bg-slate-950 px-5 py-4">
            <h3 className="font-semibold text-white">
              Forecast proof
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Predicted booking volume compared
              with unique bookings actually
              observed.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "Window",
                    "Evidence",
                    "Predicted",
                    "Actual",
                    "Difference",
                    "Error",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-5 py-3"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandHistory.map(
                  (forecast) => (
                    <tr
                      key={forecast.id}
                      className="border-t border-slate-800 text-slate-300"
                    >
                      <td className="px-5 py-4">
                        {dateFormatter.format(
                          new Date(
                            forecast
                              .windowStartAt,
                          ),
                        )}{" "}
                        →{" "}
                        {dateFormatter.format(
                          new Date(
                            forecast
                              .windowEndAt,
                          ),
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={[
                            "rounded-full border px-2 py-1 text-xs font-semibold",
                            forecast.source ===
                            "LIVE_VERIFIED"
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                              : "border-blue-400/30 bg-blue-400/10 text-blue-200",
                          ].join(" ")}
                        >
                          {forecast.source ===
                          "LIVE_VERIFIED"
                            ? "LIVE VERIFIED"
                            : "HISTORICAL BACKTEST"}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-white">
                        {
                          forecast
                            .predictedBookings
                        }
                      </td>
                      <td className="px-5 py-4 font-semibold text-emerald-300">
                        {forecast.actualBookings ??
                          "—"}
                      </td>
                      <td className="px-5 py-4">
                        {forecast.actualBookings ===
                        null
                          ? "—"
                          : forecast
                                .actualBookings -
                              forecast
                                .predictedBookings}
                      </td>
                      <td className="px-5 py-4">
                        {forecast.percentageError ===
                        null
                          ? "—"
                          : `${forecast.percentageError}%`}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Pending now"
          value={String(
            summary?.pending ?? 0,
          )}
        />
        <Metric
          label="24h accuracy"
          value={
            summary?.hitRate == null
              ? "Learning"
              : `${summary.hitRate}%`
          }
          detail={`${
            summary?.evaluated ?? 0
          } evaluated`}
        />
        <Metric
          label="3h accuracy"
          value={
            summary?.slotHitRate == null
              ? "Learning"
              : `${summary.slotHitRate}%`
          }
          detail={`${
            summary?.slotHits ?? 0
          } exact slots`}
        />
        <Metric
          label="Average slot miss"
          value={
            summary
              ?.averageSlotMissMinutes ==
            null
              ? "Learning"
              : `${
                  Math.round(
                    summary
                      .averageSlotMissMinutes /
                      6,
                  ) / 10
                }h`
          }
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800">
        <div className="bg-slate-950 px-5 py-4">
          <h3 className="font-semibold text-white">
            Performance by signal level
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Level",
                  "Evaluated",
                  "Correct",
                  "Missed",
                  "24h",
                  "3h",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-5 py-3"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.performanceByLevel ??
                []).map((item) => (
                <tr
                  key={item.level}
                  className="border-t border-slate-800 text-slate-300"
                >
                  <td className="px-5 py-4">
                    <span
                      className={[
                        "rounded-full border px-2 py-1 text-xs font-semibold",
                        levelStyle(item.level),
                      ].join(" ")}
                    >
                      {item.level}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {item.evaluated}
                  </td>
                  <td className="px-5 py-4 text-emerald-300">
                    {item.hits}
                  </td>
                  <td className="px-5 py-4">
                    {item.missed}
                  </td>
                  <td className="px-5 py-4">
                    {item.hitRate == null
                      ? "Learning"
                      : `${item.hitRate}%`}
                  </td>
                  <td className="px-5 py-4">
                    {item.slotHitRate ==
                    null
                      ? "Learning"
                      : `${item.slotHitRate}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800">
        <div className="bg-slate-950 px-5 py-4">
          <h3 className="font-semibold text-white">
            Most likely to book in 24h
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Privacy-safe individual profiles,
            ordered by observed likelihood.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Customer",
                  "Signal",
                  "Observed",
                  "Likely time",
                  "Ends",
                  "Evidence",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-5 py-3"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opportunities.map(
                (prediction) => (
                  <tr
                    key={
                      prediction.predictionId
                    }
                    className="border-t border-slate-800 text-slate-300 hover:bg-slate-900"
                  >
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenCustomer(
                            prediction.customerId,
                          )
                        }
                        className="font-semibold text-white hover:text-blue-300"
                      >
                        {prediction.customerName ??
                          "Customer profile"}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-xs font-semibold",
                          levelStyle(
                            prediction.level,
                          ),
                        ].join(" ")}
                      >
                        {prediction.level} ·{" "}
                        {prediction.score}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      {
                        prediction.observedRate
                      }
                      %
                    </td>
                    <td className="px-5 py-4">
                      {timeSlot(
                        prediction
                          .likelyWindowStartAt,
                        prediction
                          .likelyWindowEndAt,
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {dateFormatter.format(
                        new Date(
                          prediction.windowEndAt,
                        ),
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {
                        prediction
                          .evidenceConfidence
                      }
                      %
                    </td>
                  </tr>
                ),
              )}

              {opportunities.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    No active predictions.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Contact details, routes and protected
        locations are not included.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
      <p className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-white">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-xs text-slate-500">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
