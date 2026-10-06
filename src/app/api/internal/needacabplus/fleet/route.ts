import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(request: NextRequest) {
  const expected = process.env.NEEDACABPLUS_FLEET_EXPORT_KEY;
  const supplied = request.headers.get("x-needacabplus-key");

  if (!expected || !supplied) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return response(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      401,
    );
  }

  const resource = request.nextUrl.searchParams.get("resource");

  if (resource === "drivers") {
    const drivers = await prisma.driver.findMany({
      where: {
        provider: "AUTOCAB",
        active: true,
        archived: false,
      },
      orderBy: [{ callsign: "asc" }, { fullName: "asc" }],
      select: {
        externalId: true,
        callsign: true,
        forename: true,
        surname: true,
        fullName: true,
        mobile: true,
        telephone: true,
        email: true,
        badgeNumber: true,
        licenceNumber: true,
        companyId: true,
        suspended: true,
        capabilities: true,
        lastApiSyncAt: true,
      },
    });

    return response({
      success: true,
      sourceSystem: "TaxiCRM",
      generatedAt: new Date().toISOString(),
      total: drivers.length,
      drivers: drivers.map((driver) => ({
        id: driver.externalId,
        externalId: driver.externalId,
        callsign: driver.callsign,
        firstName: driver.forename,
        lastName: driver.surname,
        displayName:
          driver.fullName ||
          [driver.forename, driver.surname].filter(Boolean).join(" "),
        mobile: driver.mobile || driver.telephone,
        email: driver.email,
        badgeNumber: driver.badgeNumber,
        licenceNumber: driver.licenceNumber,
        companyId: driver.companyId,
        company: driver.companyId
          ? `TaxiCRM company ${driver.companyId}`
          : "TaxiCRM",
        status: driver.suspended ? "Suspended" : "Active",
        suspended: driver.suspended,
        active: true,
        archived: false,
        capabilities: driver.capabilities,
        lastSyncedAt: driver.lastApiSyncAt,
        sourceSystem: "TaxiCRM",
      })),
    });
  }

  if (resource === "vehicles") {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        provider: "AUTOCAB",
        isActive: true,
      },
      orderBy: [{ callsign: "asc" }, { registration: "asc" }],
      select: {
        externalId: true,
        callsign: true,
        registration: true,
        make: true,
        model: true,
        colour: true,
        vehicleType: true,
        size: true,
        plateNumber: true,
        companyId: true,
        isSuspended: true,
        capabilities: true,
        currentStatus: true,
        lastSeenAt: true,
      },
    });

    return response({
      success: true,
      sourceSystem: "TaxiCRM",
      generatedAt: new Date().toISOString(),
      total: vehicles.length,
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.externalId,
        externalId: vehicle.externalId,
        callsign: vehicle.callsign,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        colour: vehicle.colour,
        vehicleType: vehicle.vehicleType,
        passengerCapacity: vehicle.size,
        plateNumber: vehicle.plateNumber,
        companyId: vehicle.companyId,
        company: vehicle.companyId
          ? `TaxiCRM company ${vehicle.companyId}`
          : "TaxiCRM",
        status:
          vehicle.currentStatus ||
          (vehicle.isSuspended ? "Suspended" : "Active"),
        suspended: vehicle.isSuspended,
        active: true,
        capabilities: vehicle.capabilities,
        lastSeenAt: vehicle.lastSeenAt,
        sourceSystem: "TaxiCRM",
      })),
    });
  }

  return response(
    {
      success: false,
      error: "INVALID_RESOURCE",
      message: "Use resource=drivers or resource=vehicles.",
    },
    400,
  );
}
