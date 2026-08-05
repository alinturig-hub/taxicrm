import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getExecutiveDashboard } from "@/lib/analytics/executive-dashboard";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const dashboard = await getExecutiveDashboard();

  const metrics = [
    {
      label: "Revenue Today",
      value: formatCurrency(dashboard.revenueToday),
      description: "Completed bookings today",
    },
    {
      label: "Bookings Today",
      value: dashboard.bookingsToday.toLocaleString("en-GB"),
      description: "Bookings created today",
    },
    {
      label: "Completed",
      value: dashboard.completedToday.toLocaleString("en-GB"),
      description: "Completed journeys today",
    },
    {
      label: "Active Bookings",
      value: dashboard.activeBookings.toLocaleString("en-GB"),
      description: "Currently active journeys",
    },
    {
      label: "Cancelled",
      value: dashboard.cancelledToday.toLocaleString("en-GB"),
      description: "Cancelled today",
    },
    {
      label: "No Fare",
      value: dashboard.noFareToday.toLocaleString("en-GB"),
      description: "No-fare journeys today",
    },
    {
      label: "Average Booking Value",
      value: formatCurrency(dashboard.averageBookingValue),
      description: "Average completed booking value",
    },
    {
      label: "Estimated Revenue Lost",
      value: formatCurrency(dashboard.estimatedRevenueLost),
      description: "Cancelled and no-fare value",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            Executive Dashboard
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Company performance today
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Live financial and operational overview.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg"
            >
              <p className="text-sm font-medium text-slate-400">
                {metric.label}
              </p>

              <p className="mt-3 text-3xl font-bold tracking-tight text-white">
                {metric.value}
              </p>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                {metric.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Business Health
            </p>

            <h2 className="mt-3 text-xl font-bold">
              Today at a glance
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-slate-500">
                  Completion rate
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {dashboard.bookingsToday > 0
                    ? `${Math.round(
                        (dashboard.completedToday /
                          dashboard.bookingsToday) *
                          100,
                      )}%`
                    : "0%"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Cancellation rate
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {dashboard.bookingsToday > 0
                    ? `${Math.round(
                        (dashboard.cancelledToday /
                          dashboard.bookingsToday) *
                          100,
                      )}%`
                    : "0%"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  No-fare rate
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {dashboard.bookingsToday > 0
                    ? `${Math.round(
                        (dashboard.noFareToday /
                          dashboard.bookingsToday) *
                          100,
                      )}%`
                    : "0%"}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-violet-900/60 bg-violet-950/30 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-400">
              AI Advisor
            </p>

            <h2 className="mt-3 text-xl font-bold">
              Initial business signal
            </h2>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              TaxiCRM will use revenue, cancellations, no-fare events,
              driver behaviour and zone activity to generate daily
              recommendations here.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
