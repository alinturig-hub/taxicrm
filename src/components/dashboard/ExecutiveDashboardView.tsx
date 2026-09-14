import Link from "next/link";

import BusinessHealthCard from "@/components/dashboard/BusinessHealthCard";
import DashboardRealtimeHeader from "@/components/dashboard/DashboardRealtimeHeader";
import DriverCompanyCard from "@/components/dashboard/DriverCompanyCard";
import ExecutiveKpiCard from "@/components/dashboard/ExecutiveKpiCard";
import ExecutiveSummary from "@/components/dashboard/ExecutiveSummary";
import PeriodComparisonCard from "@/components/dashboard/PeriodComparisonCard";
import { getExecutiveDashboard } from "@/lib/analytics/executive-dashboard";
import { getLiveOperations } from "@/lib/operations/live-operations";
import { getDispatchDifficultyReport } from "@/lib/refusals/dispatch-difficulty";
import { londonDateKey } from "@/lib/time/london-calendar";

type SnapshotTone =
  | "blue"
  | "emerald"
  | "violet"
  | "red";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "—";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.round(seconds / 60)}m`;
}

function SnapshotMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: SnapshotTone;
}) {
  const toneClasses: Record<
    SnapshotTone,
    string
  > = {
    blue:
      "border-blue-500/25 bg-blue-500/[0.07] text-blue-300",
    emerald:
      "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300",
    violet:
      "border-violet-500/25 bg-violet-500/[0.07] text-violet-300",
    red:
      "border-red-500/25 bg-red-500/[0.07] text-red-300",
  };

  return (
    <article
      className={[
        "rounded-xl border p-4",
        toneClasses[tone],
      ].join(" ")}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.15em] opacity-80">
        {label}
      </p>

      <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-400">
        {detail}
      </p>
    </article>
  );
}

function DispatchMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-white">
        {value}
      </p>

      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

export default async function ExecutiveDashboardView() {
  const todayKey =
    londonDateKey(new Date())
      .toISOString()
      .slice(0, 10);

  const [
    dashboard,
    liveOperations,
    dispatchDifficulty,
  ] = await Promise.all([
    getExecutiveDashboard(),
    getLiveOperations({
      pastMinutes: 60,
      futureMinutes: 120,
    }),
    getDispatchDifficultyReport(
      todayKey,
      todayKey,
    ),
  ]);

  const urgentAlerts =
    liveOperations.alerts.items.slice(
      0,
      4,
    );

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white sm:px-6 sm:py-7 xl:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <DashboardRealtimeHeader />
        </header>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          <ExecutiveKpiCard
            label="Total Revenue"
            value={formatCurrency(
              dashboard.today.revenue,
            )}
            description="Measured completed and no-fare company revenue"
            trend={
              dashboard.trends
                .revenueVsYesterday
            }
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
            description="Measured account booking revenue"
          />

          <ExecutiveKpiCard
            label="Card Revenue"
            value={formatCurrency(
              dashboard.today.cardRevenue,
            )}
            description="Measured card booking revenue"
          />

          <ExecutiveKpiCard
            label={
              dashboard.trends
                .revenueVsYesterday
                .direction === "UP"
                ? "Revenue Gain"
                : dashboard.trends
                      .revenueVsYesterday
                      .direction ===
                    "DOWN"
                  ? "Revenue Decline"
                  : "Revenue Change"
            }
            value={formatCurrency(
              Math.abs(
                dashboard.trends
                  .revenueVsYesterday
                  .change,
              ),
            )}
            description="Absolute revenue change versus yesterday"
            trend={
              dashboard.trends
                .revenueVsYesterday
            }
          />

          <ExecutiveKpiCard
            label="Bookings Today"
            value={dashboard.today.bookings.toLocaleString(
              "en-GB",
            )}
            description="Bookings recorded today"
            trend={
              dashboard.trends
                .bookingsVsYesterday
            }
          />

          <ExecutiveKpiCard
            label="Completion Rate"
            value={`${dashboard.today.completionRate.toFixed(
              1,
            )}%`}
            description="Completed share of today's bookings"
          />

          <ExecutiveKpiCard
            label="Estimated Revenue Lost"
            value={formatCurrency(
              dashboard.today
                .estimatedRevenueLost,
            )}
            description="Cancelled estimates and no-fare financial loss"
            trend={
              dashboard.trends
                .lostRevenueVsYesterday
            }
            inverseTrend
          />
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                Live Operations
              </p>

              <h2 className="mt-2 text-xl font-bold text-white">
                Operational position now
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Live bookings, drivers, vehicles and urgent exceptions.
              </p>
            </div>

            <Link
              href="/dashboard/live"
              className="text-sm font-semibold text-blue-400 transition hover:text-blue-300"
            >
              Open Live Operations →
            </Link>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <SnapshotMetric
              label="Active Jobs"
              value={liveOperations.bookings.active.toLocaleString(
                "en-GB",
              )}
              detail={`${liveOperations.bookings.passengerOnBoard.toLocaleString(
                "en-GB",
              )} passenger on board`}
              tone="blue"
            />

            <SnapshotMetric
              label="Drivers On Shift"
              value={liveOperations.drivers.onShift.toLocaleString(
                "en-GB",
              )}
              detail={`${liveOperations.drivers.withVehicle.toLocaleString(
                "en-GB",
              )} currently allocated to vehicles`}
              tone="emerald"
            />

            <SnapshotMetric
              label="Live Vehicles"
              value={liveOperations.fleet.live.toLocaleString(
                "en-GB",
              )}
              detail="Vehicles seen during the last two minutes"
              tone="violet"
            />

            <SnapshotMetric
              label="Urgent Alerts"
              value={liveOperations.alerts.total.toLocaleString(
                "en-GB",
              )}
              detail="Overdue or due-soon operational exceptions"
              tone="red"
            />
          </div>

          <div className="border-t border-slate-800 px-5 py-4">
            {urgentAlerts.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {urgentAlerts.map(
                  (alert) => (
                    <div
                      key={alert.id}
                      className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-red-200">
                        {alert.title}
                      </p>

                      {alert.subtitle ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {alert.subtitle}
                        </p>
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm font-medium text-emerald-300">
                No urgent operational exceptions currently require attention.
              </p>
            )}
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-400">
                Dispatch Intelligence
              </p>

              <h2 className="mt-2 text-xl font-bold text-white">
                Allocation difficulty today
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Driver rejections measure driver offer behaviour; they do not count as customer or company outcomes.
              </p>
            </div>

            <Link
              href="/dashboard/bookings"
              className="text-sm font-semibold text-blue-400 transition hover:text-blue-300"
            >
              Open Booking Exceptions →
            </Link>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            <DispatchMetric
              label="Effective Driver Rejections"
              value={dispatchDifficulty.summary.effectiveDriverRejections.toLocaleString(
                "en-GB",
              )}
              detail="Each driver and job counted once; recovered rejections excluded"
            />

            <DispatchMetric
              label="Affected Jobs"
              value={dispatchDifficulty.summary.jobsRejectedAtLeastOnce.toLocaleString(
                "en-GB",
              )}
              detail="Jobs with at least one effective driver rejection"
            />

            <DispatchMetric
              label="Recovered"
              value={dispatchDifficulty.summary.recoveredBySameDriver.toLocaleString(
                "en-GB",
              )}
              detail="The same driver later accepted the rejected job"
            />

            <DispatchMetric
              label="Cancelled Afterwards"
              value={dispatchDifficulty.summary.cancelledAfterRejection.toLocaleString(
                "en-GB",
              )}
              detail="Final cancelled outcomes after rejection activity"
            />

            <DispatchMetric
              label="No Fare Afterwards"
              value={dispatchDifficulty.summary.noFareAfterRejection.toLocaleString(
                "en-GB",
              )}
              detail="Final no-fare outcomes after rejection activity"
            />

            <DispatchMetric
              label="Average Acceptance Time"
              value={formatDuration(
                dispatchDifficulty.summary.averageSecondsToAcceptance,
              )}
              detail="From first dispatch attempt to recorded acceptance"
            />
          </div>
        </section>

        <DriverCompanyCard
          overview={
            dashboard.driverCompany
          }
        />

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <PeriodComparisonCard
            title="Daily Performance"
            currentLabel="Today"
            previousLabel="Yesterday"
            current={dashboard.today}
            previous={
              dashboard.yesterday
            }
          />

          <PeriodComparisonCard
            title="Weekly Performance"
            currentLabel="This Week"
            previousLabel="Last Week"
            current={dashboard.week}
            previous={
              dashboard.lastWeek
            }
          />

          <PeriodComparisonCard
            title="Monthly Performance"
            currentLabel="This Month"
            previousLabel="Last Month"
            current={dashboard.month}
            previous={
              dashboard.lastMonth
            }
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <BusinessHealthCard
            period={dashboard.today}
          />

          <ExecutiveSummary
            metrics={dashboard}
          />
        </section>
      </div>
    </main>
  );
}
