import Link from "next/link";
import { getHackneyDriverPerformance } from "@/lib/analytics/hackney";
import { londonDateKey } from "@/lib/time/london-calendar";
import { hackneyPeriod } from "@/lib/analytics/hackney-performance";

export const dynamic = "force-dynamic";

export default async function HackneyPerformancePage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const year = londonDateKey(new Date()).getUTCFullYear();
  const from = searchParams.from ?? `${year}-01-01`;
  const to = searchParams.to ?? `${year}-12-31`;
  let report;
  let error;
  try {
    hackneyPeriod(from, to);
  } catch (invalid) {
    error = (invalid as Error).message;
  }
  if (!error) report = await getHackneyDriverPerformance(from, to);
  const number = (value: number) => value.toLocaleString("en-GB");
  const money = (value: number) =>
    value.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
  return (
    <main className="min-h-screen bg-slate-950 p-5 text-white sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
        Hackney Carriage
      </p>
      <h1 className="mt-2 text-2xl font-bold">Hackney Driver Performance</h1>
      <p className="mt-2 text-sm text-slate-400">
        FlaggedBooking jobs by pickup date in Europe/London. Both selected dates
        are included.
      </p>
      <form className="mt-5 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm">
          From
          <input
            className="mt-1 block rounded border border-slate-700 bg-slate-900 p-2"
            type="date"
            name="from"
            defaultValue={from}
            required
          />
        </label>
        <label className="text-sm">
          To
          <input
            className="mt-1 block rounded border border-slate-700 bg-slate-900 p-2"
            type="date"
            name="to"
            defaultValue={to}
            required
          />
        </label>
        <button className="rounded bg-amber-500 px-4 py-2 font-semibold text-slate-950">
          Apply period
        </button>
      </form>
      {error && (
        <p className="mt-4 text-red-400" role="alert">
          {error}
        </p>
      )}
      {report && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Hackney jobs", number(report.totals.total)],
              ["Completed", number(report.totals.completed)],
              [
                "Completion rate",
                report.totals.completionRate === null
                  ? "—"
                  : `${report.totals.completionRate}%`,
              ],
              ["Recorded completed fares", money(report.totals.recordedFare)],
            ].map(([label, value]) => (
              <div
                className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                key={label}
              >
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Drivers are associated by badge only. Missing, unmatched and
            duplicate badges remain unattributed; names and callsigns are not
            used to guess an association.
          </p>
          <p className="mt-2 text-sm text-amber-300">
            In this period: {number(report.quality.missingBadge)} jobs missing a
            badge, {number(report.quality.unmatchedBadge)} with an unmatched
            badge, {number(report.quality.ambiguousBadge)} with an ambiguous
            badge. {number(report.totals.completedWithoutFare)} completed jobs
            have no valid recorded fare.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {number(report.undatedBookings)} Hackney jobs across all dates have
            no pickup date and are excluded from period totals. Missing fares
            are not treated as zero; an explicitly recorded £0 fare is included.
          </p>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Hackney driver results for {from} to {to}
              </caption>
              <thead className="bg-slate-900 text-slate-300">
                <tr>
                  {[
                    "Driver / badge",
                    "Jobs",
                    "Completed",
                    "Cancelled",
                    "No fare",
                    "Other",
                    "Completion",
                    "Recorded fares",
                    "Missing fares",
                  ].map((label) => (
                    <th
                      className="whitespace-nowrap p-3"
                      scope="col"
                      key={label}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.drivers.map((row) => (
                  <tr
                    className="border-t border-slate-800"
                    key={row.badge ?? "missing"}
                  >
                    <th className="p-3 font-normal" scope="row">
                      {row.driverId ? (
                        <Link
                          className="text-blue-400"
                          href={`/dashboard/drivers/${row.driverId}`}
                        >
                          {row.driverName || "Unnamed driver"}
                        </Link>
                      ) : (
                        "Unattributed"
                      )}
                      <span className="block text-xs text-slate-400">
                        Badge: {row.badge ?? "missing"}
                        {row.association !== "matched" &&
                          ` · ${row.association}`}
                      </span>
                    </th>
                    {[
                      row.total,
                      row.completed,
                      row.cancelled,
                      row.noFare,
                      row.otherStatuses,
                    ].map((value, index) => (
                      <td className="p-3" key={index}>
                        {number(value)}
                      </td>
                    ))}
                    <td className="p-3">
                      {row.completionRate === null
                        ? "—"
                        : `${row.completionRate}%`}
                    </td>
                    <td className="p-3">{money(row.recordedFare)}</td>
                    <td className="p-3">{number(row.completedWithoutFare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.drivers.length === 0 && (
              <p className="p-5 text-slate-400">
                No dated Hackney jobs in this period.
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
