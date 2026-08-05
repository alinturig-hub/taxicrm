import { prisma } from "@/lib/prisma";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

export async function getExecutiveDashboard() {
  const today = startOfToday();

  const [
    bookingsToday,
    completedToday,
    cancelledToday,
    noFareToday,
    activeBookings,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    }),

    prisma.booking.findMany({
      where: {
        completedAt: {
          gte: today,
        },
      },
      select: {
        price: true,
        fare: true,
        cost: true,
      },
    }),

    prisma.booking.findMany({
      where: {
        cancelledAt: {
          gte: today,
        },
      },
      select: {
        price: true,
        fare: true,
        estimatedPrice: true,
      },
    }),

    prisma.booking.findMany({
      where: {
        noFareAt: {
          gte: today,
        },
      },
      select: {
        price: true,
        fare: true,
        estimatedPrice: true,
      },
    }),

    prisma.booking.count({
      where: {
        status: {
          in: [
            "ACTIVE",
            "CREATED",
            "DISPATCHED",
            "ACCEPTED",
            "ARRIVED",
            "POB",
          ],
        },
      },
    }),
  ]);

  const revenueToday = completedToday.reduce(
    (total, booking) =>
      total +
      toNumber(
        booking.fare ??
          booking.price ??
          booking.cost,
      ),
    0,
  );

  const cancelledRevenueLost =
    cancelledToday.reduce(
      (total, booking) =>
        total +
        toNumber(
          booking.price ??
            booking.fare ??
            booking.estimatedPrice,
        ),
      0,
    );

  const noFareRevenueLost = noFareToday.reduce(
    (total, booking) =>
      total +
      toNumber(
        booking.price ??
          booking.fare ??
          booking.estimatedPrice,
      ),
    0,
  );

  const completedCount = completedToday.length;

  return {
    generatedAt: new Date(),

    revenueToday: Number(revenueToday.toFixed(2)),
    bookingsToday,
    completedToday: completedCount,
    cancelledToday: cancelledToday.length,
    noFareToday: noFareToday.length,
    activeBookings,

    averageBookingValue:
      completedCount > 0
        ? Number(
            (revenueToday / completedCount).toFixed(2),
          )
        : 0,

    estimatedRevenueLost: Number(
      (
        cancelledRevenueLost +
        noFareRevenueLost
      ).toFixed(2),
    ),
  };
}
