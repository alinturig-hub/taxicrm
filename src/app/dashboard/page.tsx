import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import BusinessHealthCard from "@/components/dashboard/BusinessHealthCard";
import DashboardRealtimeHeader from "@/components/dashboard/DashboardRealtimeHeader";
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
        <header className="mb-6">
          <DashboardRealtimeHeader />
        </header>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          <ExecutiveKpiCard
            label="Total Revenue"
            value={formatCurrency(dashboard.today.revenue)}
            description="Company revenue from completed bookings"
            trend={dashboard.trends.revenueVsYesterday}
          />

          <ExecutiveKpiCard
            label="Cash Revenue"
            value={formatCurrency(
              dashboard.today.cashRevenue,
            )}
            description="Revenue from completed cash bookings"
          />

          <ExecutiveKpiCard
            label="Account Revenue"
            value={formatCurrency(
              dashboard.today.accountRevenue,
            )}
            description="Revenue from completed account bookings"
          />

          <ExecutiveKpiCard
            label="Card Revenue"
            value={formatCurrency(
              dashboard.today.cardRevenue,
            )}
            description="Revenue from completed card bookings"
          />

          <ExecutiveKpiCard
            label={
              dashboard.trends.revenueVsYesterday.direction ===
              "UP"
                ? "Revenue Gain"
                : dashboard.trends.revenueVsYesterday
                      .direction === "DOWN"
                  ? "Revenue Decline"
                  : "Revenue Change"
            }
            value={formatCurrency(
              Math.abs(
                dashboard.trends.revenueVsYesterday.change,
              ),
            )}
            description="Absolute revenue change versus yesterday"
            trend={dashboard.trends.revenueVsYesterday}
          />

          <ExecutiveKpiCard
            label="Bookings Today"
            value={dashboard.today.bookings.toLocaleString(
              "en-GB",
            )}
            description="Bookings created today"
            trend={dashboard.trends.bookingsVsYesterday}
          />

          <ExecutiveKpiCard
            label="Completion Rate"
            value={`${dashboard.today.completionRate.toFixed(
              1,
            )}%`}
            description="Completed share of bookings"
          />

          <ExecutiveKpiCard
            label="Revenue Lost"
            value={formatCurrency(
              dashboard.today.estimatedRevenueLost,
            )}
            description="Cancelled and no-fare value"
            trend={
              dashboard.trends.lostRevenueVsYesterday
            }
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
