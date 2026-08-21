import { prisma } from "@/lib/prisma";
import { calculateNoFareFinancials } from "@/lib/revenue/no-fare-financials";
import {
  addLondonDays,
  startOfLondonWeek,
} from "@/lib/time/london-calendar";

function positiveNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : 0;
}

function round(value: number) {
  return Number(value.toFixed(2));
}

export type DriverCompanyOverview = {
  from: Date;
  to: Date;
  driverEarnings: number;
  companyRevenue: number;
  companyGrossMargin: number;
  earningDrivers: number;
  fullRentDrivers: number;
  estimatedRent: number;
  rentPercentage: number;
  weeklyCap: number;
  fullRentThreshold: number;
};

export async function getDriverCompanyOverview(
  date = new Date(),
): Promise<DriverCompanyOverview> {
  const from = startOfLondonWeek(date);
  const to = addLondonDays(from, 7);

  const [
    configuration,
    completedBookings,
    noFareBookings,
  ] = await Promise.all([
    prisma.driverRentConfiguration.upsert({
      where: {
        key: "GLOBAL",
      },
      create: {
        key: "GLOBAL",
        rentPercentage: 20,
        weeklyCap: 160,
      },
      update: {},
    }),

    prisma.booking.findMany({
      where: {
        completedAt: {
          gte: from,
          lt: to,
        },
        driverId: {
          not: null,
        },
      },
      select: {
        driverId: true,
        cost: true,
        price: true,
      },
    }),

    prisma.booking.findMany({
      where: {
        noFareAt: {
          gte: from,
          lt: to,
        },
        driverId: {
          not: null,
        },
      },
      select: {
        driverId: true,
        paymentType: true,
        bookingSource: true,
        accountName: true,
        arrivedAt: true,
        noFareAt: true,
        price: true,
        estimatedPrice: true,
        fare: true,
      },
    }),
  ]);

  const rentPercentage = Number(
    configuration.rentPercentage,
  );
  const weeklyCap = Number(
    configuration.weeklyCap,
  );

  const driverTotals = new Map<string, number>();
  let driverEarnings = 0;
  let companyRevenue = 0;

  for (const booking of completedBookings) {
    if (!booking.driverId) {
      continue;
    }

    const driverValue = positiveNumber(
      booking.cost,
    );
    const companyValue = positiveNumber(
      booking.price,
    );

    driverEarnings += driverValue;
    companyRevenue += companyValue;

    driverTotals.set(
      booking.driverId,
      (driverTotals.get(booking.driverId) ?? 0) +
        driverValue,
    );
  }

  for (const booking of noFareBookings) {
    if (!booking.driverId) {
      continue;
    }

    const financials =
      calculateNoFareFinancials(booking);

    driverEarnings += financials.driverCost;
    companyRevenue +=
      financials.companyRevenue;

    driverTotals.set(
      booking.driverId,
      (driverTotals.get(booking.driverId) ?? 0) +
        financials.driverCost,
    );
  }

  let fullRentDrivers = 0;
  let estimatedRent = 0;

  driverTotals.forEach((earnings) => {
    const percentageRent =
      earnings * (rentPercentage / 100);

    const driverRent = Math.min(
      percentageRent,
      weeklyCap,
    );

    estimatedRent += driverRent;

    if (
      percentageRent >= weeklyCap &&
      weeklyCap > 0
    ) {
      fullRentDrivers += 1;
    }
  });

  return {
    from,
    to,
    driverEarnings: round(driverEarnings),
    companyRevenue: round(companyRevenue),
    companyGrossMargin: round(
      companyRevenue - driverEarnings,
    ),
    earningDrivers: driverTotals.size,
    fullRentDrivers,
    estimatedRent: round(estimatedRent),
    rentPercentage,
    weeklyCap,
    fullRentThreshold:
      rentPercentage > 0
        ? round(
            weeklyCap /
              (rentPercentage / 100),
          )
        : 0,
  };
}
