import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      { status: 401 },
    );
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      provider: "AUTOCAB",
      isActive: true,
    },
    orderBy: [
      {
        callsign: "asc",
      },
      {
        registration: "asc",
      },
    ],
    select: {
      id: true,
      externalId: true,
      companyId: true,
      callsign: true,
      make: true,
      model: true,
      colour: true,
      yearOfManufacture: true,
      vehicleType: true,
      registration: true,
      plateNumber: true,
      isSuspended: true,
      isActive: true,
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
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    total: vehicles.length,
    vehicles,
  });
}
