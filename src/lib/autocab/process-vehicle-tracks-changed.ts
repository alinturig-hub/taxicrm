import { Prisma } from "@/generated/prisma/client";
import { isObject, normaliseString } from "@/lib/autocab/booking-mappers";
import { prisma } from "@/lib/prisma";

function parseOptionalInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  const normalised = normaliseString(value);

  if (!normalised) {
    return null;
  }

  const parsed = Number.parseInt(normalised, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

function parseCoordinate(value: unknown, fieldName: string): Prisma.Decimal {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`Missing ${fieldName}.`);
  }

  const normalised =
    typeof value === "number" ? value.toString() : value.trim();

  if (!normalised) {
    throw new Error(`Missing ${fieldName}.`);
  }

  try {
    return new Prisma.Decimal(normalised);
  } catch {
    throw new Error(`Invalid ${fieldName}: ${normalised}`);
  }
}

function parseSnapshotDate(value: unknown): Date {
  const normalised = normaliseString(value);

  if (!normalised) {
    throw new Error("Missing VehicleTrack Timestamp.");
  }

  const date = new Date(normalised);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid VehicleTrack Timestamp: ${normalised}`);
  }

  return date;
}

function getVehicleTracks(payload: Prisma.JsonValue): Prisma.JsonObject[] {
  if (!isObject(payload)) {
    throw new Error("Webhook payload is not a JSON object.");
  }

  const tracks = payload.VehicleTracks;

  if (!Array.isArray(tracks)) {
    throw new Error(
      "VehicleTracksChanged payload does not contain VehicleTracks.",
    );
  }

  return tracks.filter((track): track is Prisma.JsonObject => isObject(track));
}

export async function processVehicleTracksChangedWebhook(
  webhookEventId: string,
): Promise<void> {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: {
      id: webhookEventId,
    },
    select: {
      id: true,
      status: true,
      payload: true,
    },
  });

  if (!webhookEvent) {
    throw new Error(`WebhookEvent not found: ${webhookEventId}`);
  }

  if (webhookEvent.status === "PROCESSED") {
    return;
  }

  const tracks = getVehicleTracks(webhookEvent.payload);

  await prisma.webhookEvent.update({
    where: {
      id: webhookEvent.id,
    },
    data: {
      status: "PROCESSING",
      processingError: null,
      attemptCount: {
        increment: 1,
      },
    },
  });

  try {
    await prisma.$transaction(async (tx) => {
      for (const track of tracks) {
        if (!isObject(track.Vehicle)) {
          throw new Error("VehicleTrack is missing the Vehicle payload.");
        }

        const vehiclePayload = track.Vehicle;
        const vehicleExternalId = normaliseString(vehiclePayload.Id);

        if (!vehicleExternalId) {
          throw new Error("VehicleTrack is missing the Autocab vehicle ID.");
        }

        let driverId: string | null = null;

        if (isObject(track.Driver)) {
          const driverPayload = track.Driver;
          const driverExternalId = normaliseString(driverPayload.Id);

          if (driverExternalId) {
            const driver = await tx.driver.upsert({
              where: {
                provider_externalId: {
                  provider: "AUTOCAB",
                  externalId: driverExternalId,
                },
              },
              create: {
                provider: "AUTOCAB",
                externalId: driverExternalId,
                callsign: normaliseString(driverPayload.Callsign),
                forename: normaliseString(driverPayload.Forename),
                surname: normaliseString(driverPayload.Surname),
                badgeNumber: normaliseString(driverPayload.BadgeNumber),
                licenceNumber: normaliseString(driverPayload.LicenceNumber),
                rawPayload: driverPayload as Prisma.InputJsonObject,
              },
              update: {
                callsign: normaliseString(driverPayload.Callsign),
                forename: normaliseString(driverPayload.Forename),
                surname: normaliseString(driverPayload.Surname),
                badgeNumber: normaliseString(driverPayload.BadgeNumber),
                licenceNumber: normaliseString(driverPayload.LicenceNumber),
                rawPayload: driverPayload as Prisma.InputJsonObject,
              },
            });

            driverId = driver.id;
          }
        }

        if (!isObject(track.CurrentLocation)) {
          throw new Error(
            `VehicleTrack for vehicle ${vehicleExternalId} is missing CurrentLocation.`,
          );
        }

        const latitude = parseCoordinate(
          track.CurrentLocation.Latitude,
          "CurrentLocation.Latitude",
        );

        const longitude = parseCoordinate(
          track.CurrentLocation.Longitude,
          "CurrentLocation.Longitude",
        );

        const vehicleStatus = normaliseString(track.VehicleStatus) ?? "Unknown";

        const bookingId = parseOptionalInteger(track.BookingId);

        const snapshotAt = parseSnapshotDate(track.Timestamp);

        const vehicle = await tx.vehicle.upsert({
          where: {
            provider_externalId: {
              provider: "AUTOCAB",
              externalId: vehicleExternalId,
            },
          },
          create: {
            provider: "AUTOCAB",
            externalId: vehicleExternalId,
            callsign: normaliseString(vehiclePayload.Callsign),
            deviceId: normaliseString(vehiclePayload.DeviceId),
            vinNumber: normaliseString(vehiclePayload.VINNumber),
            plateNumber: normaliseString(vehiclePayload.PlateNumber),
            registration: normaliseString(vehiclePayload.Registration),
            rawPayload: vehiclePayload as Prisma.InputJsonObject,
            currentDriverId: driverId,
            currentStatus: vehicleStatus,
            currentBookingId: bookingId,
            currentLatitude: latitude,
            currentLongitude: longitude,
            lastSeenAt: snapshotAt,
          },
          update: {
            callsign: normaliseString(vehiclePayload.Callsign),
            deviceId: normaliseString(vehiclePayload.DeviceId),
            vinNumber: normaliseString(vehiclePayload.VINNumber),
            plateNumber: normaliseString(vehiclePayload.PlateNumber),
            registration: normaliseString(vehiclePayload.Registration),
            rawPayload: vehiclePayload as Prisma.InputJsonObject,
            currentDriverId: driverId,
            currentStatus: vehicleStatus,
            currentBookingId: bookingId,
            currentLatitude: latitude,
            currentLongitude: longitude,
            lastSeenAt: snapshotAt,
          },
        });

        await tx.vehicleSnapshot.create({
          data: {
            provider: "AUTOCAB",
            vehicleId: vehicle.id,
            driverId,
            bookingId,
            vehicleStatus,
            latitude,
            longitude,
            snapshotAt,
            sourceWebhookId: webhookEvent.id,
            rawPayload: track as Prisma.InputJsonObject,
          },
        });
      }

      await tx.webhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          status: "PROCESSED",
          processingError: null,
          processedAt: new Date(),
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown VehicleTracksChanged processing error.";

    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "FAILED",
        processingError: message.slice(0, 5000),
      },
    });

    throw error;
  }
}
