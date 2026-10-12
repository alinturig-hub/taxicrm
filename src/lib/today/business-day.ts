import { yesterdayAtLondonClock } from "./comparison";
import { prisma } from "@/lib/prisma";
import { startOfLondonDay, addLondonDays } from "@/lib/time/london-calendar";
import {
  accountRevenueRuleKey,
  calculateBookingRevenue,
  loadAccountRevenueRuleMap,
  roundMoney,
} from "@/lib/revenue/booking-revenue";

async function businessPeriod(
  can: (permission: string) => boolean,
  now = new Date(),
) {
  const start = startOfLondonDay(now),
    end = addLondonDays(start, 1);
  const today = { gte: start, lt: end },
    elapsed = { gte: start, lte: now };
  const [booked, pickups, completed, cancelled, failed] = await Promise.all([
    can("bookings.view")
      ? prisma.booking.count({ where: { bookedAtTime: elapsed } })
      : null,
    can("bookings.view")
      ? prisma.booking.count({ where: { pickupDueTime: today } })
      : null,
    can("bookings.view")
      ? prisma.booking.count({ where: { completedAt: elapsed } })
      : null,
    can("bookings.view")
      ? prisma.booking.count({ where: { cancelledAt: elapsed } })
      : null,
    can("integrations.view")
      ? prisma.webhookEvent.count({
          where: { receivedAt: elapsed, status: "FAILED" },
        })
      : null,
  ]);
  let revenue: number | null = null,
    missingAmounts = 0;
  if (can("dashboard.view")) {
    revenue = 0;
    let cursor: string | undefined;
    // Recognize revenue on the completion/no-fare event date, not a future pickup.
    // Bound memory and leave original payloads untouched.
    for (;;) {
      const bookings = await prisma.booking.findMany({
        where: {
          ...(cursor ? { id: { gt: cursor } } : {}),
          OR: [
            { completedAt: elapsed },
            { completedAt: null, noFareAt: elapsed, accountId: { not: null } },
          ],
        },
        orderBy: { id: "asc" },
        take: 250,
        select: {
          id: true,
          status: true,
          completedAt: true,
          noFareAt: true,
          arrivedAt: true,
          price: true,
          cost: true,
          provider: true,
          accountId: true,
        },
      });
      if (!bookings.length) break;
      const rules = await loadAccountRevenueRuleMap(bookings);
      for (const booking of bookings) {
        if (booking.price === null && booking.cost === null) missingAmounts++;
        const key = accountRevenueRuleKey(booking);
        revenue += calculateBookingRevenue(
          booking,
          key ? rules.get(key) : undefined,
        );
      }
      cursor = bookings[bookings.length - 1].id;
      if (bookings.length < 250) break;
    }
    revenue = roundMoney(revenue);
  }
  return {
    generatedAt: now.toISOString(),
    date: new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeZone: "Europe/London",
    }).format(start),
    booked,
    pickups,
    completed,
    cancelled,
    failed,
    revenue,
    missingAmounts,
  };
}
export async function todayBusinessSummary(
  can: (permission: string) => boolean,
  now = new Date(),
) {
  const previous = yesterdayAtLondonClock(now);
  const [today, yesterday] = await Promise.all([
    businessPeriod(can, now),
    businessPeriod(can, previous),
  ]);
  return {
    ...today,
    yesterday,
    comparisonTime: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      timeStyle: "short",
    }).format(now),
    profit: null as number | null,
  };
}

export type TodayBusinessSummary = Awaited<
  ReturnType<typeof todayBusinessSummary>
>;
