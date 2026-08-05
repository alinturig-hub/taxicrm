import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import BusinessHealthCard from "@/components/dashboard/BusinessHealthCard";
import ExecutiveKpiCard from "@/components/dashboard/ExecutiveKpiCard";
import ExecutiveSummary from "@/components/dashboard/ExecutiveSummary";
import PeriodComparisonCard from "@/components/dashboard/PeriodComparisonCard";
import { getExecutiveDashboard } from "@/lib/analytics/executive-dashboard";
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

  const dashboard = await getExecutiveDashboard();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-7 xl:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 sm:mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400 sm:text-sm">
            Executive Dashboard
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl xl:text-4xl">
            Company performance
          </h1>

          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400 sm:text-sm">
            Live financial and operational intelligence from real
            company data.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          <ExecutiveKpiCard
            label="Revenue Today"
            value={formatCurrency(dashboard.today.revenue)}
            description="Revenue from completed bookings"
            trend={dashboard.trends.revenueVsYesterday}
          />

          <ExecutiveKpiCard
            label="Bookings Today"
            value={dashboard.today.bookings.toLocaleString("en-GB")}
            description="Bookings created today"
            trend={dashboard.trends.bookingsVsYesterday}
          />

          <ExecutiveKpiCard
            label="Completion Rate"
            value={`${dashboard.today.completionRate.toFixed(1)}%`}
            description="Completed share of bookings"
          />

          <ExecutiveKpiCard
            label="Revenue Lost"
            value={formatCurrency(
              dashboard.today.estimatedRevenueLost,
            )}
            description="Cancelled and no-fare value"
            trend={dashboard.trends.lostRevenueVsYesterday}
            inverseTrend
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <PeriodComparisonCard
            title="Daily Performance"
            currentLabel="Today"
            previousLabel="Yesterday"
            current={dashboard.today}
            previous={dashboard.yesterday}
          />

          <PeriodComparisonCard
            title="Weekly Performance"
            currentLabel="This Week"
            previousLabel="Last Week"
            current={dashboard.week}
            previous={dashboard.lastWeek}
          />

          <PeriodComparisonCard
            title="Monthly Performance"
            currentLabel="This Month"
            previousLabel="Last Month"
            current={dashboard.month}
            previous={dashboard.lastMonth}
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <BusinessHealthCard period={dashboard.today} />
          <ExecutiveSummary metrics={dashboard} />
        </section>
      </div>
    </main>
  );
}
