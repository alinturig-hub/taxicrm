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

  window: {
    pastMinutes: number;
    futureMinutes: number;
    startsAt: Date;
    endsAt: Date;
  };

  bookings: {
    active: number;
    asap: number;
    advanced: number;
    overdue: number;
    dueSoon: number;
    upcoming: number;
    later: number;
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

    items: Array<{
      id: string;
      severity:
        | "critical"
        | "warning"
        | "info"
        | "success";
      title: string;
      subtitle?: string;
      bookingId?: string;
      occurredAt: string;
    }>;
  };

  recentActivity: Array<{
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    bookingId: string;
    externalBookingId: string;
    status: string;
    customerName: string | null;
    driverName: string | null;
    pickupAddress: string | null;
    destinationAddress: string | null;
    fare: number | null;
    occurredAt: Date;
  }>;
};

function startOfToday(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

type LiveOperationsOptions = {
  pastMinutes?: number;
  futureMinutes?: number;
};

function clampMinutes(
  value: number | undefined,
  fallback: number,
): number {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.min(
    1440,
    Math.max(0, Math.round(value)),
  );
}

export async function getLiveOperations(
  options: LiveOperationsOptions = {},
): Promise<LiveOperationsData> {
  const now = new Date();
  const today = startOfToday(now);

  const pastMinutes = clampMinutes(
    options.pastMinutes,
    60,
  );

  const futureMinutes = clampMinutes(
    options.futureMinutes,
    120,
  );

  const liveWindowStart = new Date(
    now.getTime() - pastMinutes * 60 * 1000,
  );

  const liveWindowEnd = new Date(
    now.getTime() + futureMinutes * 60 * 1000,
  );

  const dueSoonEnd = new Date(
    now.getTime() + 10 * 60 * 1000,
  );

  const upcomingEnd = new Date(
    now.getTime() + 20 * 60 * 1000,
  );

  const activeWindowWhere = {
    status: {
      in: ACTIVE_BOOKING_STATUSES,
    },
    pickupDueTime: {
      gte: liveWindowStart,
      lte: liveWindowEnd,
    },
  };

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
    asap,
    advanced,
    overdue,
    dueSoon,
    upcoming,
    later,
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
        pickupDueTime: {
          gte: liveWindowStart,
          lte: liveWindowEnd,
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: "DISPATCHED",
        pickupDueTime: {
          gte: liveWindowStart,
          lte: liveWindowEnd,
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: "ACCEPTED",
        pickupDueTime: {
          gte: liveWindowStart,
          lte: liveWindowEnd,
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: "ARRIVED",
        pickupDueTime: {
          gte: liveWindowStart,
          lte: liveWindowEnd,
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: "POB",
        pickupDueTime: {
          gte: liveWindowStart,
          lte: liveWindowEnd,
        },
      },
    }),

    prisma.booking.count({
      where: {
        ...activeWindowWhere,
        typeOfBooking: "ASAP",
      },
    }),

    prisma.booking.count({
      where: {
        ...activeWindowWhere,
        typeOfBooking: "Advanced",
      },
    }),

    prisma.booking.count({
      where: {
        status: {
          in: ACTIVE_BOOKING_STATUSES,
        },
        pickupDueTime: {
          gte: liveWindowStart,
          lt: now,
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: {
          in: ACTIVE_BOOKING_STATUSES,
        },
        pickupDueTime: {
          gte: now,
          lte: dueSoonEnd,
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: {
          in: ACTIVE_BOOKING_STATUSES,
        },
        pickupDueTime: {
          gt: dueSoonEnd,
          lte: upcomingEnd,
        },
      },
    }),

    prisma.booking.count({
      where: {
        status: {
          in: ACTIVE_BOOKING_STATUSES,
        },
        pickupDueTime: {
          gt: upcomingEnd,
          lte: liveWindowEnd,
        },
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
          gte: liveWindowStart,
          lte: now,
        },
        pickedUpAt: null,
      },
    }),

    prisma.booking.count({
      where: {
        ...activeWindowWhere,
        driverId: null,
      },
    }),

    prisma.booking.count({
      where: {
        status: "ACCEPTED",
        acceptedAt: {
          lte: acceptedWarningThreshold,
        },
        pickupDueTime: {
          gte: liveWindowStart,
          lte: liveWindowEnd,
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
      take: 15,
      select: {
        id: true,
        eventType: true,
        title: true,
        description: true,
        occurredAt: true,
        booking: {
          select: {
            id: true,
            externalId: true,
            status: true,
            customerName: true,
            driverCallSign: true,
            driverForename: true,
            driverSurname: true,
            fare: true,
            price: true,
            locations: {
              orderBy: {
                type: "asc",
              },
              select: {
                type: true,
                address: true,
              },
            },
          },
        },
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

  const recentActivityFeed = recentActivity.map((event) => {
    const pickup =
      event.booking.locations.find(
        (location) => location.type === "PICKUP",
      )?.address ?? null;

    const destination =
      event.booking.locations.find(
        (location) => location.type === "DESTINATION",
      )?.address ?? null;

    const driverName =
      [
        event.booking.driverForename,
        event.booking.driverSurname,
      ]
        .filter(Boolean)
        .join(" ") ||
      event.booking.driverCallSign ||
      null;

    const priceValue =
      event.booking.price === null
        ? 0
        : Number(event.booking.price);

    const fareValue =
      event.booking.fare === null
        ? 0
        : Number(event.booking.fare);

    const displayPrice =
      priceValue > 0
        ? priceValue
        : fareValue > 0
          ? fareValue
          : null;

    return {
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      bookingId: event.booking.id,
      externalBookingId: event.booking.externalId,
      status: event.booking.status,
      customerName: event.booking.customerName,
      driverName,
      pickupAddress: pickup,
      destinationAddress: destination,
      fare: displayPrice,
      occurredAt: event.occurredAt,
    };
  });

  return {
    generatedAt: now,

    window: {
      pastMinutes,
      futureMinutes,
      startsAt: liveWindowStart,
      endsAt: liveWindowEnd,
    },

    bookings: {
      active: activeBookings,
      asap,
      advanced,
      overdue,
      dueSoon,
      upcoming,
      later,
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

      items: [
        ...(fleet.stale > 0
          ? [{
              id: "stale-vehicles",
              severity: "warning" as const,
              title: `${fleet.stale} stale vehicles`,
              subtitle:
                "Vehicles offline for more than 2 minutes",
              occurredAt: now.toISOString(),
            }]
          : []),

        ...(withoutDriver > 0
          ? [{
              id: "bookings-without-driver",
              severity: "critical" as const,
              title: `${withoutDriver} bookings without driver`,
              occurredAt: now.toISOString(),
            }]
          : []),

        ...(acceptedOver15Minutes > 0
          ? [{
              id: "accepted-over-15",
              severity: "warning" as const,
              title: `${acceptedOver15Minutes} accepted over 15 minutes`,
              occurredAt: now.toISOString(),
            }]
          : []),

        ...(driversWithoutVehicle > 0
          ? [{
              id: "drivers-without-vehicle",
              severity: "info" as const,
              title: `${driversWithoutVehicle} drivers without vehicle`,
              occurredAt: now.toISOString(),
            }]
          : []),
      ],
    },

    recentActivity: recentActivityFeed,
  };
}
