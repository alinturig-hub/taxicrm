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

  const vehicleRecords = await prisma.vehicle.findMany({
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
      size: true,
      capabilities: true,
      registration: true,
      plateNumber: true,
      ownerDriverId: true,
      secondOwnerDriverId: true,
      isSuspended: true,
      isActive: true,
    },
  });

  const assignedDriverExternalIds =
    Array.from(
      new Set(
        vehicleRecords.flatMap(
          (vehicle) => [
            vehicle.ownerDriverId,
            vehicle.secondOwnerDriverId,
          ],
        )
          .filter(
            (driverId): driverId is number =>
              driverId !== null,
          )
          .map(String),
      ),
    );

  const assignedDrivers =
    assignedDriverExternalIds.length > 0
      ? await prisma.driver.findMany({
          where: {
            provider: "AUTOCAB",
            externalId: {
              in: assignedDriverExternalIds,
            },
          },
          select: {
            id: true,
            externalId: true,
            callsign: true,
            forename: true,
            surname: true,
          },
        })
      : [];

  const driverByExternalId =
    new Map(
      assignedDrivers.map(
        (driver) => [
          driver.externalId,
          {
            ...driver,
            resolved: true,
          },
        ],
      ),
    );

  const vehicles =
    vehicleRecords.map((vehicle) => {
      const capabilityCount =
        Array.isArray(vehicle.capabilities)
          ? vehicle.capabilities.length
          : 0;

      const assignedVehicleDrivers = [
        vehicle.ownerDriverId,
        vehicle.secondOwnerDriverId,
      ]
        .filter(
          (driverId): driverId is number =>
            driverId !== null,
        )
        .map((driverId) => {
          const externalId =
            String(driverId);

          return (
            driverByExternalId.get(
              externalId,
            ) ?? {
              id:
                `autocab-${externalId}`,
              externalId,
              callsign: null,
              forename: null,
              surname: null,
              resolved: false,
            }
          );
        });

      return {
        ...vehicle,
        capabilityCount,
        assignedDrivers:
          assignedVehicleDrivers,
      };
    });

  return NextResponse.json({
    success: true,
    total: vehicles.length,
    vehicles,
  });
}
