import type { CompanyMetricPeriod } from "@/lib/analytics/company";

type Props = {
  period: CompanyMetricPeriod;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export default function BusinessHealthCard({
  period,
}: Props) {
  const items = [
    {
      label: "Completion",
      value: `${period.completionRate.toFixed(1)}%`,
    },
    {
      label: "Cancellation",
      value: `${period.cancellationRate.toFixed(1)}%`,
    },
    {
      label: "No-Fare",
      value: `${period.noFareRate.toFixed(1)}%`,
    },
    {
      label: "Average Booking",
      value: formatCurrency(
        period.averageCompletedBookingValue,
      ),
    },
  ];

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
        Business Health
      </p>

      <h2 className="mt-2 text-lg font-bold text-white">
        Today at a glance
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
          >
            <p className="text-[11px] leading-4 text-slate-500 sm:text-xs">
              {item.label}
            </p>

            <p className="mt-1.5 text-xl font-bold text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
