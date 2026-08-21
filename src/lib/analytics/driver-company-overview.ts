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
  earningDriverWeeks: number;
  fullRentDrivers: number;
  fullRentDriverWeeks: number;
  estimatedRent: number;
  rentPercentage: number;
  weeklyCap: number;
  fullRentThreshold: number;
};

export async function getDriverCompanyOverviewForRange(
  from: Date,
  to: Date,
): Promise<DriverCompanyOverview> {
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
        completedAt: true,
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
  const driverWeekTotals =
    new Map<string, number>();

  let driverEarnings = 0;
  let companyRevenue = 0;

  const addDriverEarnings = (
    driverId: string,
    occurredAt: Date,
    amount: number,
  ) => {
    if (amount <= 0) {
      return;
    }

    driverTotals.set(
      driverId,
      (driverTotals.get(driverId) ?? 0) +
        amount,
    );

    const weekKey =
      startOfLondonWeek(occurredAt).toISOString();

    const driverWeekKey =
      `${weekKey}::${driverId}`;

    driverWeekTotals.set(
      driverWeekKey,
      (
        driverWeekTotals.get(driverWeekKey) ??
        0
      ) + amount,
    );
  };

  for (const booking of completedBookings) {
    if (
      !booking.driverId ||
      !booking.completedAt
    ) {
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

    addDriverEarnings(
      booking.driverId,
      booking.completedAt,
      driverValue,
    );
  }

  for (const booking of noFareBookings) {
    if (
      !booking.driverId ||
      !booking.noFareAt
    ) {
      continue;
    }

    const financials =
      calculateNoFareFinancials(booking);

    driverEarnings += financials.driverCost;
    companyRevenue +=
      financials.companyRevenue;

    addDriverEarnings(
      booking.driverId,
      booking.noFareAt,
      financials.driverCost,
    );
  }

  let fullRentDriverWeeks = 0;
  let estimatedRent = 0;
  const fullRentDriverIds = new Set<string>();

  driverWeekTotals.forEach(
    (earnings, driverWeekKey) => {
      const percentageRent =
        earnings * (rentPercentage / 100);

      estimatedRent += Math.min(
        percentageRent,
        weeklyCap,
      );

      if (
        percentageRent >= weeklyCap &&
        weeklyCap > 0
      ) {
        fullRentDriverWeeks += 1;

        const separator =
          driverWeekKey.indexOf("::");

        fullRentDriverIds.add(
          driverWeekKey.slice(separator + 2),
        );
      }
    },
  );

  return {
    from,
    to,
    driverEarnings: round(driverEarnings),
    companyRevenue: round(companyRevenue),
    companyGrossMargin: round(
      companyRevenue - driverEarnings,
    ),
    earningDrivers: driverTotals.size,
    earningDriverWeeks: driverWeekTotals.size,
    fullRentDrivers: fullRentDriverIds.size,
    fullRentDriverWeeks,
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

export async function getDriverCompanyOverview(
  date = new Date(),
): Promise<DriverCompanyOverview> {
  const from = startOfLondonWeek(date);
  const to = addLondonDays(from, 7);

  return getDriverCompanyOverviewForRange(
    from,
    to,
  );
}
