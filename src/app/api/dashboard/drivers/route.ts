import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  const drivers = await prisma.driver.findMany({
    where: {
      provider: "AUTOCAB",
      active: true,
      archived: false,
    },
    orderBy: [
      {
        callsign: "asc",
      },
      {
        fullName: "asc",
      },
    ],
    select: {
      id: true,
      externalId: true,
      callsign: true,
      fullName: true,
      forename: true,
      surname: true,
      mobile: true,
      telephone: true,
      email: true,
      badgeNumber: true,
      licenceNumber: true,
      suspended: true,
      badgeExpiryDate: true,
      licenceExpiryDate: true,
      insuranceExpiryDate: true,
      currentVehicles: {
        select: {
          id: true,
          externalId: true,
          callsign: true,
          registration: true,
          plateNumber: true,
          make: true,
          model: true,
          currentStatus: true,
          lastSeenAt: true,
        },
        take: 1,
      },
      shifts: {
        where: {
          status: "ACTIVE",
        },
        orderBy: {
          startedAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          startedAt: true,
          vehicle: {
            select: {
              id: true,
              externalId: true,
              callsign: true,
              registration: true,
              plateNumber: true,
              make: true,
              model: true,
              currentStatus: true,
              lastSeenAt: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    drivers: drivers.map((driver) => {
      const activeShift = driver.shifts[0] ?? null;
      const currentVehicle =
        activeShift?.vehicle ??
        driver.currentVehicles[0] ??
        null;

      return {
        id: driver.id,
        externalId: driver.externalId,
        callsign: driver.callsign,
        fullName:
          driver.fullName ||
          [driver.forename, driver.surname]
            .filter(Boolean)
            .join(" "),
        mobile: driver.mobile,
        telephone: driver.telephone,
        email: driver.email,
        badgeNumber: driver.badgeNumber,
        licenceNumber: driver.licenceNumber,
        suspended: driver.suspended,
        badgeExpiryDate: driver.badgeExpiryDate,
        licenceExpiryDate: driver.licenceExpiryDate,
        insuranceExpiryDate: driver.insuranceExpiryDate,
        shift: activeShift
          ? {
              id: activeShift.id,
              startedAt: activeShift.startedAt,
            }
          : null,
        vehicle: currentVehicle,
      };
    }),
  });
}
