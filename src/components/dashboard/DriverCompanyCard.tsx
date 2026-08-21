import type { DriverCompanyOverview } from "@/lib/analytics/driver-company-overview";

type DriverCompanyCardProps = {
  overview: DriverCompanyOverview;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default function DriverCompanyCard({
  overview,
}: DriverCompanyCardProps) {
  const weekEnd = new Date(
    overview.to.getTime() - 1,
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
      label: "Full Rent Drivers",
      value: `${overview.fullRentDrivers} of ${overview.earningDrivers}`,
      description: `Drivers reaching the ${formatCurrency(
        overview.weeklyCap,
      )} weekly cap`,
    },
    {
      label: "Estimated Rent",
      value: formatCurrency(
        overview.estimatedRent,
      ),
      description: `${overview.rentPercentage.toFixed(
        2,
      )}% of earnings, capped per driver`,
    },
  ];

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-black/10">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
            Weekly Driver Economics
          </p>

          <h2 className="mt-2 text-xl font-bold text-white">
            Drivers vs Company
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            {formatDate(overview.from)} –{" "}
            {formatDate(weekEnd)}, Europe/London
          </p>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          Full Rent threshold:{" "}
          <strong>
            {formatCurrency(
              overview.fullRentThreshold,
            )}
          </strong>{" "}
          driver earnings
        </div>
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
    </section>
  );
}
