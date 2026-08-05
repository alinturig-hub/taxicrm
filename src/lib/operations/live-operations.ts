import { prisma } from "@/lib/prisma";

const ACTIVE_BOOKING_STATUSES = [
  "CREATED",
  "DISPATCHED",
  "ACCEPTED",
  "ARRIVED",
  "POB",
];

export type LiveOperationsData = {
  generatedAt: Date;

  bookings: {
    active: number;
    created: number;
    dispatched: number;
    accepted: number;
    arrived: number;
    passengerOnBoard: number;
    completedToday: number;
    cancelledToday: number;
    noFareToday: number;
    waitingPickup: number;
    withoutDriver: number;
  };

  fleet: {
    totalTracked: number;
    live: number;
    stale: number;
    clear: number;
    busy: number;
    notWorking: number;
  };

  drivers: {
    onShift: number;
    withVehicle: number;
    withoutVehicle: number;
  };

  alerts: {
    total: number;
    staleVehicles: number;
    bookingsWithoutDriver: number;
    acceptedOver15Minutes: number;
    driversWithoutVehicle: number;
  };

  recentActivity: Array<{
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    bookingId: string;
    occurredAt: Date;
  }>;
};

function startOfToday(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export async function getLiveOperations(): Promise<LiveOperationsData> {
  const now = new Date();
  const today = startOfToday(now);

  const liveThreshold = new Date(
    now.getTime() - 2 * 60 * 1000,
  );

  const acceptedWarningThreshold = new Date(
    now.getTime() - 15 * 60 * 1000,
  );

  const [
    created,
    dispatched,
    accepted,
    arrived,
    passengerOnBoard,
    completedToday,
    cancelledToday,
    noFareToday,
    waitingPickup,
    withoutDriver,
    acceptedOver15Minutes,
    trackedVehicles,
    activeShifts,
    recentActivity,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        status: "CREATED",
      },
    }),

    prisma.booking.count({
      where: {
        status: "DISPATCHED",
      },
    }),

    prisma.booking.count({
      where: {
        status: "ACCEPTED",
      },
    }),

    prisma.booking.count({
      where: {
        status: "ARRIVED",
      },
    }),

    prisma.booking.count({
      where: {
        status: "POB",
      },
    }),

    prisma.booking.count({
      where: {
        completedAt: {
          gte: today,
        },
      },
    }),

    prisma.booking.count({
      where: {
        cancelledAt: {
          gte: today,
        },
      },
    }),

    prisma.booking.count({
      where: {
        noFareAt: {
          gte: today,
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: {
          in: [
            "CREATED",
            "DISPATCHED",
            "ACCEPTED",
            "ARRIVED",
          ],
        },
        pickupDueTime: {
          lte: now,
        },
        pickedUpAt: null,
      },
    }),

    prisma.booking.count({
      where: {
        status: {
          in: ACTIVE_BOOKING_STATUSES,
        },
        driverId: null,
      },
    }),

    prisma.booking.count({
      where: {
        status: "ACCEPTED",
        acceptedAt: {
          lte: acceptedWarningThreshold,
        },
        pickedUpAt: null,
      },
    }),

    prisma.vehicle.findMany({
      where: {
        lastSeenAt: {
          not: null,
        },
      },
      select: {
        currentStatus: true,
        currentBookingId: true,
        lastSeenAt: true,
      },
    }),

    prisma.driverShift.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        vehicleId: true,
      },
    }),

    prisma.bookingTimelineEvent.findMany({
      orderBy: {
        occurredAt: "desc",
      },
      take: 12,
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        bookingId: true,
        occurredAt: true,
      },
    }),
  ]);

  const fleet = trackedVehicles.reduce(
    (summary, vehicle) => {
      summary.totalTracked += 1;

      const isLive =
        vehicle.lastSeenAt !== null &&
        vehicle.lastSeenAt >= liveThreshold;

      if (isLive) {
        summary.live += 1;
      } else {
        summary.stale += 1;
      }

      if (vehicle.currentStatus === "Clear") {
        summary.clear += 1;
      } else if (
        vehicle.currentStatus === "NotWorking"
      ) {
        summary.notWorking += 1;
      } else {
        summary.busy += 1;
      }

      return summary;
    },
    {
      totalTracked: 0,
      live: 0,
      stale: 0,
      clear: 0,
      busy: 0,
      notWorking: 0,
    },
  );

  const driversWithVehicle = activeShifts.filter(
    (shift) => shift.vehicleId !== null,
  ).length;

  const driversWithoutVehicle =
    activeShifts.length - driversWithVehicle;

  const activeBookings =
    created +
    dispatched +
    accepted +
    arrived +
    passengerOnBoard;

  const totalAlerts =
    fleet.stale +
    withoutDriver +
    acceptedOver15Minutes +
    driversWithoutVehicle;

  return {
    generatedAt: now,

    bookings: {
      active: activeBookings,
      created,
      dispatched,
      accepted,
      arrived,
      passengerOnBoard,
      completedToday,
      cancelledToday,
      noFareToday,
      waitingPickup,
      withoutDriver,
    },

    fleet,

    drivers: {
      onShift: activeShifts.length,
      withVehicle: driversWithVehicle,
      withoutVehicle: driversWithoutVehicle,
    },

    alerts: {
      total: totalAlerts,
      staleVehicles: fleet.stale,
      bookingsWithoutDriver: withoutDriver,
      acceptedOver15Minutes,
      driversWithoutVehicle,
    },

    recentActivity,
  };
}
