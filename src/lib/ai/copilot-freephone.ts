import { Prisma } from "@/generated/prisma/client";
import { bookingTimeSql } from "@/lib/notifications/booking-evidence";
import { sourceFields } from "@/lib/notifications/operations";
import { normaliseFreephoneNumber, telephoneSql } from "@/lib/notifications/phone-audit";
import { prisma } from "@/lib/prisma";
import { addLondonDays, addLondonMonths, startOfLondonDay, startOfLondonMonth, startOfLondonWeek } from "@/lib/time/london-calendar";
import { matchingFreephoneLines, type FreephonePeriod } from "./copilot-booking-scope";

const sources = [{ label: "Operations → Notifications", href: "/dashboard/operations/notifications" }];
const periodFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short",
});

export function freephoneClarification(summary: string) {
  return {
    headline: "Freephone booking count needs clarification",
    summary,
    metrics: [],
    evidence: [],
    sources,
  };
}

export async function freephoneBookings(lineName: string, now: Date, period: FreephonePeriod = "this week", noShows = false) {
  const today = startOfLondonDay(now);
  const week = startOfLondonWeek(now);
  const month = startOfLondonMonth(now);
  const windows = {
    today: [today, now],
    yesterday: [addLondonDays(today, -1), today],
    "this week": [week, now],
    "last week": [addLondonDays(week, -7), week],
    "this month": [month, now],
    "last month": [addLondonMonths(month, -1), month],
  };
  const [start, end] = windows[period];
  const upperBound = end === now ? Prisma.sql`<=` : Prisma.sql`<`;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '10s'`;
    const lines = await tx.notificationJob.findMany({
      where: { id: { not: "$gateway-test" } },
      select: { name: true, sourceField: true, sourceValue: true, sourceConfirmed: true },
      orderBy: { name: "asc" },
    });
    const matches = matchingFreephoneLines(lines, lineName);
    const [line] = matches;
    if (!line) return {
      verified: false,
      answer: freephoneClarification("I could not find that line in Operations → Notifications. What is its configured name?"),
    };
    if (matches.length > 1) return {
      verified: false,
      answer: freephoneClarification(`Which configured Freephone line do you mean? ${matches.map(({ name }) => name).join(" · ")}`),
    };
    const source = sourceFields.find((field) => field === line.sourceField);
    if (!source || (source !== "telephoneNumber" && !line.sourceConfirmed)) return {
      verified: false,
      answer: freephoneClarification(`${line.name} needs a confirmed booking source in Operations → Notifications.`),
    };

    const field = source === "telephoneNumber" ? telephoneSql() : Prisma.raw(`"${source}"`);
    const value = source === "telephoneNumber" ? normaliseFreephoneNumber(line.sourceValue) : line.sourceValue;
    // Prisma stores timezone-less outcome timestamps in UTC.
    if (noShows) await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
    const time = noShows ? Prisma.sql`"noFareAt"::timestamptz` : bookingTimeSql();
    const outcome = noShows ? Prisma.sql`AND ("noFareAt" IS NOT NULL OR status = 'NO_FARE')` : Prisma.empty;
    const unit = noShows ? "no-show" : "booking";
    const [row] = await tx.$queryRaw<{ total: bigint; undated: bigint }[]>`
      WITH matched AS MATERIALIZED (
        SELECT ${time} AS booked_at
        FROM "Booking"
        WHERE provider = 'AUTOCAB' AND ${field} = ${value} ${outcome}
      )
      SELECT count(*) FILTER (WHERE booked_at >= ${start.toISOString()}::timestamptz
        AND booked_at ${upperBound} ${end.toISOString()}::timestamptz) AS total,
        count(*) FILTER (WHERE booked_at IS NULL) AS undated
      FROM matched
    `;
    const total = Number(row.total);
    const undated = Number(row.undated);
    return {
      verified: undated === 0,
      answer: {
        headline: `${total.toLocaleString("en-GB")} ${unit}${total === 1 ? "" : "s"} from ${line.name}`,
        summary: `${periodFormat.format(start)} to ${periodFormat.format(end)} (Europe/London).`,
        metrics: [{ label: noShows ? "No-shows (no fare)" : "Bookings", value: total }],
        evidence: [
          "Counts unique Autocab bookings matching the booking source configured for this Freephone line.",
          ...(noShows ? ["No-shows use the recorded Autocab no-fare outcome time."] : []),
          ...(undated ? [`${undated.toLocaleString("en-GB")} matching bookings have no verified ${noShows ? "no-fare outcome" : "creation"} timestamp and could not be assigned to the period.`] : []),
        ],
        sources,
      },
    };
  }, { timeout: 15000 });
}
