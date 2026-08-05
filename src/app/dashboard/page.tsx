import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import BusinessHealthCard from "@/components/dashboard/BusinessHealthCard";
import ExecutiveKpiCard from "@/components/dashboard/ExecutiveKpiCard";
import ExecutiveSummary from "@/components/dashboard/ExecutiveSummary";
import PeriodComparisonCard from "@/components/dashboard/PeriodComparisonCard";
import { getCompanyMetrics } from "@/lib/analytics/company";
import { authOptions } from "@/lib/auth";

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

  const metrics = await getCompanyMetrics();

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            Executive Dashboard
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Company performance
          </h1>

          <p className="mt-3 text-sm text-slate-400">
            Live financial and operational intelligence from
            real company data.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ExecutiveKpiCard
            label="Revenue Today"
            value={formatCurrency(metrics.today.revenue)}
            description="Revenue from completed bookings"
            trend={metrics.trends.revenueVsYesterday}
          />

          <ExecutiveKpiCard
            label="Bookings Today"
            value={metrics.today.bookings.toLocaleString("en-GB")}
            description="Bookings created today"
            trend={metrics.trends.bookingsVsYesterday}
          />

          <ExecutiveKpiCard
            label="Completion Rate"
            value={`${metrics.today.completionRate.toFixed(1)}%`}
            description="Completed bookings as a share of bookings created"
          />

          <ExecutiveKpiCard
            label="Revenue Lost"
            value={formatCurrency(
              metrics.today.estimatedRevenueLost,
            )}
            description="Estimated cancelled and no-fare value"
            trend={metrics.trends.lostRevenueVsYesterday}
            inverseTrend
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <PeriodComparisonCard
            title="Daily Performance"
            currentLabel="Today"
            previousLabel="Yesterday"
            current={metrics.today}
            previous={metrics.yesterday}
          />

          <PeriodComparisonCard
            title="Weekly Performance"
            currentLabel="This Week"
            previousLabel="Last Week"
            current={metrics.week}
            previous={metrics.lastWeek}
          />

          <PeriodComparisonCard
            title="Monthly Performance"
            currentLabel="This Month"
            previousLabel="Last Month"
            current={metrics.month}
            previous={metrics.lastMonth}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <BusinessHealthCard period={metrics.today} />
          <ExecutiveSummary metrics={metrics} />
        </section>
      </div>
    </main>
  );
}
