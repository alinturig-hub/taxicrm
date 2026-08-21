"use client";

import { useState } from "react";

import type { DriverCompanyOverview } from "@/lib/analytics/driver-company-overview";

type DriverCompanyCardProps = {
  overview: DriverCompanyOverview;
};

type DisplayOverview =
  Omit<DriverCompanyOverview, "from" | "to"> & {
    from: string;
    to: string;
  };

type SelectedPeriod =
  | "this-week"
  | "last-week"
  | "custom";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateInputValue(value: string) {
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  );

  const parts = formatter.formatToParts(
    new Date(value),
  );

  const part = (type: string) =>
    parts.find((item) => item.type === type)
      ?.value ?? "";

  return `${part("year")}-${part("month")}-${part(
    "day",
  )}`;
}

function serializeInitial(
  overview: DriverCompanyOverview,
): DisplayOverview {
  return {
    ...overview,
    from: overview.from.toISOString(),
    to: overview.to.toISOString(),
  };
}

export default function DriverCompanyCard({
  overview: initialOverview,
}: DriverCompanyCardProps) {
  const [overview, setOverview] =
    useState<DisplayOverview>(
      serializeInitial(initialOverview),
    );

  const [selectedPeriod, setSelectedPeriod] =
    useState<SelectedPeriod>("this-week");

  const [fromDate, setFromDate] = useState(
    dateInputValue(
      initialOverview.from.toISOString(),
    ),
  );

  const initialInclusiveTo = new Date(
    initialOverview.to.getTime() - 1,
  );

  const [toDate, setToDate] = useState(
    dateInputValue(
      initialInclusiveTo.toISOString(),
    ),
  );

  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const loadPeriod = async (
    period: SelectedPeriod,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const query =
        period === "custom"
          ? new URLSearchParams({
              from: fromDate,
              to: toDate,
            })
          : new URLSearchParams({
              preset: period,
            });

      const response = await fetch(
        `/api/dashboard/driver-company-overview?${query.toString()}`,
        {
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        overview?: DisplayOverview;
      };

      if (
        !response.ok ||
        !payload.success ||
        !payload.overview
      ) {
        throw new Error(
          payload.message ??
            "Figures could not be loaded.",
        );
      }

      setOverview(payload.overview);
      setSelectedPeriod(period);

      if (period !== "custom") {
        setFromDate(
          dateInputValue(
            payload.overview.from,
          ),
        );

        const inclusiveTo = new Date(
          new Date(
            payload.overview.to,
          ).getTime() - 1,
        );

        setToDate(
          dateInputValue(
            inclusiveTo.toISOString(),
          ),
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Figures could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  const inclusiveTo = new Date(
    new Date(overview.to).getTime() - 1,
  ).toISOString();

  const multipleWeeks =
    overview.earningDriverWeeks >
    overview.earningDrivers;

  const fullRentBase =
    overview.fullRentDriverWeeks *
    overview.weeklyCap;

  const percentageBasedRent = Math.max(
    overview.estimatedRent - fullRentBase,
    0,
  );

  const metrics = [
    {
      label: "Driver Earnings",
      value: formatCurrency(
        overview.driverEarnings,
      ),
      description:
        "Completed Cost plus No Fare driver amounts",
    },
    {
      label: "Company Revenue",
      value: formatCurrency(
        overview.companyRevenue,
      ),
      description:
        "Completed Price plus No Fare company amounts",
    },
    {
      label: "Gross Margin",
      value: formatCurrency(
        overview.companyGrossMargin,
      ),
      description:
        "Company Revenue minus Driver Earnings",
    },
    {
      label: multipleWeeks
        ? "Full Rent Driver-Weeks"
        : "Full Rent Drivers",
      value: multipleWeeks
        ? `${overview.fullRentDriverWeeks} of ${overview.earningDriverWeeks}`
        : `${overview.fullRentDrivers} of ${overview.earningDrivers}`,
      description: multipleWeeks
        ? "Each driver is counted once for every selected week"
        : `Drivers reaching the ${formatCurrency(
            overview.weeklyCap,
          )} weekly cap`,
    },
    {
      label:
        "Estimated Driver Rent Collected",
      value: formatCurrency(
        overview.estimatedRent,
      ),
      description: `${formatCurrency(
        fullRentBase,
      )} at full cap + ${formatCurrency(
        percentageBasedRent,
      )} percentage-based rent`,
    },
  ];

  const buttonClass = (
    period: SelectedPeriod,
  ) =>
    [
      "rounded-xl border px-4 py-2 text-sm font-semibold transition",
      selectedPeriod === period
        ? "border-blue-500 bg-blue-600 text-white"
        : "border-slate-700 bg-slate-950 text-slate-300 hover:border-blue-500/50",
    ].join(" ");

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-black/10">
      <div className="border-b border-slate-800 p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              Driver Economics
            </p>

            <h2 className="mt-2 text-xl font-bold text-white">
              Drivers vs Company
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              {formatDate(overview.from)} –{" "}
              {formatDate(inclusiveTo)},
              Europe/London
            </p>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            Full Rent threshold:{" "}
            <strong>
              {formatCurrency(
                overview.fullRentThreshold,
              )}
            </strong>{" "}
            driver earnings per week
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void loadPeriod("this-week")
            }
            className={buttonClass("this-week")}
          >
            This Week
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void loadPeriod("last-week")
            }
            className={buttonClass("last-week")}
          >
            Last Week
          </button>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              From
            </span>

            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setSelectedPeriod("custom");
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              To
            </span>

            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setSelectedPeriod("custom");
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>

          <button
            type="button"
            disabled={
              loading ||
              !fromDate ||
              !toDate
            }
            onClick={() =>
              void loadPeriod("custom")
            }
            className={buttonClass("custom")}
          >
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-400">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-px bg-slate-800 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="bg-slate-900 p-5"
          >
            <p className="text-sm font-medium text-slate-400">
              {metric.label}
            </p>

            <p className="mt-3 text-2xl font-bold tracking-tight text-white">
              {metric.value}
            </p>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              {metric.description}
            </p>
          </article>
        ))}
      </div>

      <div className="border-t border-slate-800 bg-slate-950/40 px-5 py-4">
        <p className="text-xs leading-5 text-slate-400">
          Estimated Driver Rent Collected is
          the total rent expected from drivers:
          {` ${overview.rentPercentage.toFixed(
            2,
          )}%`}{" "}
          of each driver&apos;s earnings, limited
          to {formatCurrency(
            overview.weeklyCap,
          )} per driver for each Monday–Sunday
          week.
        </p>
      </div>
    </section>
  );
}
