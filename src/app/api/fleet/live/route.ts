import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addLondonDays,
  startOfLondonDay,
} from "@/lib/time/london-calendar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getOperationalStatus(
  vehicleStatus: string | null,
  bookingStatus: string | undefined,
): "CLEAR" | "DOW" | "DAP" | "POB" {
  if (bookingStatus === "POB") {
    return "POB";
  }

  if (bookingStatus === "ARRIVED") {
    return "DAP";
  }

  if (
    vehicleStatus === "BusyMeterOnFromClear" ||
    vehicleStatus === "BusyMeterOnFromMeterOffCash" ||
    vehicleStatus === "BusyMeterOnFromMeterOffAccount"
  ) {
    return "POB";
  }

  if (
    vehicleStatus === "BusyMeterOff" ||
    vehicleStatus === "BusyMeterOffAccount"
  ) {
    return "DOW";
  }

  return "CLEAR";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        error: "UNAUTHORIZED",
        message: "Authentication required.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        currentLatitude: {
          not: null,
        },
        currentLongitude: {
          not: null,
        },
        lastSeenAt: {
          not: null,
        },
        currentStatus: {
          not: "NotWorking",
        },
      },
      orderBy: [
        {
          lastSeenAt: "desc",
        },
        {
          callsign: "asc",
        },
      ],
      select: {
        id: true,
        provider: true,
        externalId: true,
        callsign: true,
        registration: true,
        plateNumber: true,
        currentStatus: true,
        currentBookingId: true,
        currentLatitude: true,
        currentLongitude: true,
        lastSeenAt: true,
        currentDriver: {
          select: {
            id: true,
            externalId: true,
            callsign: true,
            forename: true,
            surname: true,
            badgeNumber: true,
          },
        },
      },
    });

    const currentBookingIds = Array.from(
      new Set(
        vehicles
          .map((vehicle) => vehicle.currentBookingId)
          .filter(
            (bookingId): bookingId is number =>
              bookingId !== null && bookingId > 0,
          )
          .map(String),
      ),
    );

    const currentBookings =
      currentBookingIds.length > 0
        ? await prisma.booking.findMany({
            where: {
              provider: "AUTOCAB",
              externalId: {
                in: currentBookingIds,
              },
            },
            select: {
          externalId: true,
          status: true,
          locations: {
            select: {
              type: true,
              address: true,
            },
          },
        },
          })
        : [];

    const bookingStatusByExternalId = new Map(
      currentBookings.map((booking) => [
        booking.externalId,
        booking.status,
      ]),
    );

    const bookingByExternalId = new Map(
      currentBookings.map((booking) => [
        booking.externalId,
        booking,
      ]),
    );

    const nowDate = new Date();
    const todayFrom = startOfLondonDay(nowDate);
    const todayTo = addLondonDays(todayFrom, 1);

    const liveDriverExternalIds = Array.from(
      new Set(
        vehicles
          .map((vehicle) => vehicle.currentDriver?.externalId)
          .filter(
            (externalId): externalId is string =>
              Boolean(externalId),
          ),
      ),
    );

    const todayCompletedBookings =
      liveDriverExternalIds.length > 0
        ? await prisma.booking.findMany({
            where: {
              driverId: {
                in: liveDriverExternalIds,
              },
              pickupDueTime: {
                gte: todayFrom,
                lt: todayTo,
              },
              OR: [
                {
                  completedAt: {
                    not: null,
                  },
                },
                {
                  status: "COMPLETED",
                },
              ],
            },
            select: {
              driverId: true,
              price: true,
              cost: true,
            },
          })
        : [];

    const todayRevenueByDriver = new Map<string, number>();

    for (const booking of todayCompletedBookings) {
      if (!booking.driverId) {
        continue;
      }

      const price = Number(booking.price ?? 0);
      const cost = Number(booking.cost ?? 0);
      const value = price > 0 ? price : cost;

      todayRevenueByDriver.set(
        booking.driverId,
        (todayRevenueByDriver.get(booking.driverId) ?? 0) + value,
      );
    }

    const now = nowDate.getTime();

    const liveVehicles = vehicles
      .map((vehicle) => {
        const latitude = toNumber(vehicle.currentLatitude);
        const longitude = toNumber(vehicle.currentLongitude);

        if (
          latitude === null ||
          longitude === null ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          return null;
        }

        const lastSeenAt = vehicle.lastSeenAt;
        const ageSeconds = lastSeenAt
          ? Math.max(
              0,
              Math.floor((now - lastSeenAt.getTime()) / 1000),
            )
          : null;

        const driverName = [
          vehicle.currentDriver?.forename,
          vehicle.currentDriver?.surname,
        ]
          .filter(Boolean)
          .join(" ");

        return {
          id: vehicle.id,
          provider: vehicle.provider,
          externalId: vehicle.externalId,
          callsign: vehicle.callsign,
          registration:
            vehicle.registration || vehicle.plateNumber || null,
          status: vehicle.currentStatus || "Unknown",
          operationalStatus: getOperationalStatus(
            vehicle.currentStatus,
            vehicle.currentBookingId &&
              vehicle.currentBookingId > 0
              ? bookingStatusByExternalId.get(
                  String(vehicle.currentBookingId),
                )
              : undefined,
          ),
          bookingId:
            vehicle.currentBookingId &&
            vehicle.currentBookingId > 0
              ? vehicle.currentBookingId
              : null,
          pickupAddress:
            vehicle.currentBookingId &&
            vehicle.currentBookingId > 0
              ? bookingByExternalId
                  .get(String(vehicle.currentBookingId))
                  ?.locations.find(
                    (location) => location.type === "PICKUP",
                  )?.address ?? null
              : null,
          destinationAddress:
            vehicle.currentBookingId &&
            vehicle.currentBookingId > 0
              ? bookingByExternalId
                  .get(String(vehicle.currentBookingId))
                  ?.locations.find(
                    (location) => location.type === "DESTINATION",
                  )?.address ?? null
              : null,
          latitude,
          longitude,
          lastSeenAt: lastSeenAt?.toISOString() || null,
          ageSeconds,
          isLive: ageSeconds !== null && ageSeconds <= 120,
          driver: vehicle.currentDriver
            ? {
                id: vehicle.currentDriver.id,
                externalId: vehicle.currentDriver.externalId,
                callsign: vehicle.currentDriver.callsign,
                name: driverName || null,
                badgeNumber: vehicle.currentDriver.badgeNumber,
                todayRevenue:
                  todayRevenueByDriver.get(
                    vehicle.currentDriver.externalId,
                  ) ?? 0,
              }
            : null,
        };
      })
      .filter(
        (
          vehicle,
        ): vehicle is NonNullable<typeof vehicle> =>
          vehicle !== null,
      );

    const summary = liveVehicles.reduce(
      (accumulator, vehicle) => {
        accumulator.total += 1;

        if (vehicle.isLive) {
          accumulator.live += 1;
        } else {
          accumulator.stale += 1;
        }

        if (vehicle.status === "Clear") {
          accumulator.clear += 1;
        } else if (vehicle.status === "NotWorking") {
          accumulator.notWorking += 1;
        } else {
          accumulator.busy += 1;
        }

        return accumulator;
      },
      {
        total: 0,
        live: 0,
        stale: 0,
        clear: 0,
        busy: 0,
        notWorking: 0,
      },
    );

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        refreshAfterSeconds: 10,
        summary,
        vehicles: liveVehicles,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Failed to load live fleet:", error);

    return NextResponse.json(
      {
        error: "LIVE_FLEET_LOAD_FAILED",
        message: "Unable to load live fleet data.",
      },
      {
        status: 500,
      },
    );
  }
}
