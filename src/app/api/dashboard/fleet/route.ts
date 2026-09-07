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

  const capabilityRecords =
    await prisma.apiEndpointRecord.findMany({
      where: {
        isActive: true,
        endpoint: {
          name: "Capabilities",
        },
      },
      select: {
        externalId: true,
        data: true,
      },
    });

  const capabilityByExternalId =
    new Map<
      string,
      {
        id: string;
        name: string;
        shortCode: string | null;
      }
    >();

  for (
    const record
    of capabilityRecords
  ) {
    if (
      record.data === null ||
      typeof record.data !== "object" ||
      Array.isArray(record.data)
    ) {
      continue;
    }

    const data =
      record.data as Record<
        string,
        unknown
      >;

    if (
      typeof data.name !== "string" ||
      data.name.trim().length === 0
    ) {
      continue;
    }

    capabilityByExternalId.set(
      record.externalId,
      {
        id: record.externalId,
        name: data.name.trim(),
        shortCode:
          typeof data.shortCode === "string" &&
          data.shortCode.trim().length > 0
            ? data.shortCode.trim()
            : null,
      },
    );
  }

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
      const capabilityIds =
        Array.isArray(vehicle.capabilities)
          ? vehicle.capabilities
              .map(String)
              .filter(
                (capabilityId) =>
                  capabilityId.length > 0,
              )
          : [];

      const resolvedCapabilities =
        capabilityIds.map(
          (capabilityId) =>
            capabilityByExternalId.get(
              capabilityId,
            ) ?? {
              id: capabilityId,
              name:
                `Capability ${capabilityId}`,
              shortCode: null,
            },
        );

      const capabilityCount =
        resolvedCapabilities.length;

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
        capabilities:
          resolvedCapabilities,
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
