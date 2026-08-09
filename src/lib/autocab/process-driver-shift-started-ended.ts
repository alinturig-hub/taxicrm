import { Prisma } from "@/generated/prisma/client";
import { isObject, normaliseString } from "@/lib/autocab/booking-mappers";
import { prisma } from "@/lib/prisma";

function parseRequiredDate(value: unknown, fieldName: string): Date {
  const normalised = normaliseString(value);

  if (!normalised) {
    throw new Error(`Missing ${fieldName}.`);
  }

  const date = new Date(normalised);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${normalised}`);
  }

  return date;
}

function parseOptionalDate(value: unknown): Date | null {
  const normalised = normaliseString(value);

  if (!normalised) {
    return null;
  }

  const date = new Date(normalised);

  return Number.isNaN(date.getTime()) ? null : date;
}

export async function processDriverShiftStartedEndedWebhook(
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

  if (!isObject(webhookEvent.payload)) {
    throw new Error("Webhook payload is not a JSON object.");
  }

  const payload = webhookEvent.payload;

  if (!isObject(payload.Driver)) {
    throw new Error("Missing Autocab driver payload.");
  }

  const driverPayload = payload.Driver;

  const driverExternalId = normaliseString(driverPayload.Id);

  if (!driverExternalId) {
    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "FAILED",
        processingError: "Missing Autocab driver ID.",
        attemptCount: {
          increment: 1,
        },
      },
    });

    throw new Error("Missing Autocab driver ID.");
  }

  const startedAt = parseRequiredDate(payload.StartedDate, "StartedDate");

  const endedAt = parseOptionalDate(payload.EndedDate);
  const modifiedAt = parseOptionalDate(payload.ModifiedDate);

  const subEventType = normaliseString(payload.SubEventType) ?? "Unknown";

  const isEnded = subEventType.toLowerCase() === "ended";

  const durationSeconds =
    isEnded && endedAt
      ? Math.max(
          0,
          Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000),
        )
      : null;

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

      let vehicleId: string | null = null;

      if (isObject(payload.Vehicle)) {
        const vehiclePayload = payload.Vehicle;
        const vehicleExternalId = normaliseString(vehiclePayload.Id);

        if (vehicleExternalId) {
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
            },
            update: {
              callsign: normaliseString(vehiclePayload.Callsign),
              deviceId: normaliseString(vehiclePayload.DeviceId),
              vinNumber: normaliseString(vehiclePayload.VINNumber),
              plateNumber: normaliseString(vehiclePayload.PlateNumber),
              registration: normaliseString(vehiclePayload.Registration),
              rawPayload: vehiclePayload as Prisma.InputJsonObject,
            },
          });

          vehicleId = vehicle.id;
        }
      }

      if (isEnded) {
        const toleranceMs = 2_000;

        const matchingActiveShift = await tx.driverShift.findFirst({
          where: {
            provider: "AUTOCAB",
            driverId: driver.id,
            status: "ACTIVE",
            startedAt: {
              gte: new Date(startedAt.getTime() - toleranceMs),
              lte: new Date(startedAt.getTime() + toleranceMs),
            },
          },
          orderBy: {
            startedAt: "desc",
          },
        });

        if (matchingActiveShift) {
          const matchedDurationSeconds = endedAt
            ? Math.max(
                0,
                Math.floor(
                  (endedAt.getTime() -
                    matchingActiveShift.startedAt.getTime()) /
                    1000,
                ),
              )
            : null;

          await tx.driverShift.update({
            where: {
              id: matchingActiveShift.id,
            },
            data: {
              vehicleId,
              status: "ENDED",
              subEventType,
              endedAt,
              modifiedAt,
              durationSeconds: matchedDurationSeconds,
              sourceWebhookEvent: webhookEvent.id,
              rawPayload: payload as Prisma.InputJsonObject,
            },
          });
        } else {
          await tx.driverShift.upsert({
            where: {
              provider_driverId_startedAt: {
                provider: "AUTOCAB",
                driverId: driver.id,
                startedAt,
              },
            },
            create: {
              provider: "AUTOCAB",
              driverId: driver.id,
              vehicleId,
              status: "ENDED",
              subEventType,
              startedAt,
              endedAt,
              modifiedAt,
              durationSeconds,
              sourceWebhookEvent: webhookEvent.id,
              rawPayload: payload as Prisma.InputJsonObject,
            },
            update: {
              vehicleId,
              status: "ENDED",
              subEventType,
              endedAt,
              modifiedAt,
              durationSeconds,
              sourceWebhookEvent: webhookEvent.id,
              rawPayload: payload as Prisma.InputJsonObject,
            },
          });
        }
      } else {
        await tx.driverShift.upsert({
          where: {
            provider_driverId_startedAt: {
              provider: "AUTOCAB",
              driverId: driver.id,
              startedAt,
            },
          },
          create: {
            provider: "AUTOCAB",
            driverId: driver.id,
            vehicleId,
            status: "ACTIVE",
            subEventType,
            startedAt,
            endedAt: null,
            modifiedAt,
            durationSeconds: null,
            sourceWebhookEvent: webhookEvent.id,
            rawPayload: payload as Prisma.InputJsonObject,
          },
          update: {
            vehicleId,
            status: "ACTIVE",
            subEventType,
            endedAt: null,
            modifiedAt,
            durationSeconds: null,
            sourceWebhookEvent: webhookEvent.id,
            rawPayload: payload as Prisma.InputJsonObject,
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
        : "Unknown DriverShiftStartedEnded processing error.";

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
