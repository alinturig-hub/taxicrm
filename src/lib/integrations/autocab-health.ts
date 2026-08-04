import { prisma } from "@/lib/prisma";

export async function getAutocabHealth() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalToday,
    failedToday,
    ignoredToday,
    lastEvent,
  ] = await Promise.all([
    prisma.webhookEvent.count({
      where: {
        receivedAt: {
          gte: startOfToday,
        },
      },
    }),

    prisma.webhookEvent.count({
      where: {
        status: "FAILED",
        receivedAt: {
          gte: startOfToday,
        },
      },
    }),

    prisma.webhookEvent.count({
      where: {
        status: "IGNORED",
        receivedAt: {
          gte: startOfToday,
        },
      },
    }),

    prisma.webhookEvent.findFirst({
      orderBy: {
        receivedAt: "desc",
      },
      select: {
        receivedAt: true,
      },
    }),
  ]);

  const health =
    totalToday === 0
      ? 100
      : Math.max(
          0,
          Math.round(
            ((totalToday - failedToday) / totalToday) * 100,
          ),
        );

  return {
    connected: lastEvent !== null,
    health,
    eventsToday: totalToday,
    failedToday,
    ignoredToday,
    lastEvent: lastEvent?.receivedAt ?? null,
  };
}
