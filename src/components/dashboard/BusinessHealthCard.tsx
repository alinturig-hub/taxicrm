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
      label: "Completion Rate",
      value: `${period.completionRate.toFixed(1)}%`,
    },
    {
      label: "Cancellation Rate",
      value: `${period.cancellationRate.toFixed(1)}%`,
    },
    {
      label: "No-Fare Rate",
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
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
        Business Health
      </p>

      <h2 className="mt-3 text-xl font-bold text-white">
        Today at a glance
      </h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <p className="text-sm text-slate-500">
              {item.label}
            </p>

            <p className="mt-2 text-2xl font-bold text-white">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
