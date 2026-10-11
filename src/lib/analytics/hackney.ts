import { prisma } from "@/lib/prisma";

export type HackneyMetrics = {
  total: number;
  completed: number;
  otherStatuses: number;
  monthly: {
    month: number;
    total: number;
    completed: number;
  }[];
};

export async function getHackneyMetrics(
  year = 2026,
): Promise<HackneyMetrics> {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));

  const rows = await prisma.$queryRaw<
    { month: number; total: bigint; completed: bigint }[]
  >`
    SELECT
      EXTRACT(MONTH FROM "pickupDueTime")::int AS month,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE "status" = 'COMPLETED'
      )::bigint AS completed
    FROM "Booking"
    WHERE "bookingSource" = 'FlaggedBooking'
      AND "pickupDueTime" >= ${from}
      AND "pickupDueTime" < ${to}
    GROUP BY 1
    ORDER BY 1
  `;

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const row = rows.find((item) => item.month === index + 1);
    return {
      month: index + 1,
      total: Number(row?.total ?? 0),
      completed: Number(row?.completed ?? 0),
    };
  });

  const total = monthly.reduce((sum, m) => sum + m.total, 0);
  const completed = monthly.reduce(
    (sum, m) => sum + m.completed,
    0,
  );

  return {
    total,
    completed,
    otherStatuses: total - completed,
    monthly,
  };
}
