import { Prisma } from "@/generated/prisma/client";
import {
  buildBookingCreateData,
  buildBookingUpdateData,
  isObject,
  normaliseString,
} from "@/lib/autocab/booking-mappers";
import {
  synchroniseLocation,
  synchroniseVias,
} from "@/lib/autocab/booking-synchronisers";
import { prisma } from "@/lib/prisma";
import { createBookingSnapshot } from "@/lib/services/booking-snapshot-service";
import { appendBookingTimelineEvent } from "@/lib/services/booking-timeline-service";

export async function processBookingCreatedWebhook(
  webhookEventId: string,
): Promise<void> {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: {
      id: webhookEventId,
    },
    select: {
      id: true,
      provider: true,
      eventType: true,
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
  const externalId = normaliseString(
    payload.Id ?? payload.BookingId ?? payload.OriginalBookingId,
  );

  if (!externalId) {
    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "FAILED",
        processingError: "Missing Autocab booking ID.",
        attemptCount: {
          increment: 1,
        },
      },
    });

    throw new Error("Missing Autocab booking ID.");
  }

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
    const bookingId = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.upsert({
        where: {
          provider_externalId: {
            provider: "AUTOCAB",
            externalId,
          },
        },
        create: buildBookingCreateData(payload, externalId),
        update: buildBookingUpdateData(payload),
        select: {
          id: true,
        },
      });

      await synchroniseLocation(
        tx,
        booking.id,
        payload,
        "Pickup",
        "PICKUP",
      );

      await synchroniseLocation(
        tx,
        booking.id,
        payload,
        "Destination",
        "DESTINATION",
      );

      await synchroniseVias(tx, booking.id, payload);

      await tx.webhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          externalBookingId: externalId,
          bookingId: booking.id,
          status: "PROCESSED",
          processingError: null,
          processedAt: new Date(),
        },
      });

      return booking.id;
    });

    await createBookingSnapshot({
      bookingId,
      webhookEventId: webhookEvent.id,
    });

    await appendBookingTimelineEvent({
      bookingId,
      webhookEventId: webhookEvent.id,
      eventType: webhookEvent.eventType,
      title: "Booking Created",
      description: "Booking created in Autocab.",
      metadata: payload as Prisma.InputJsonObject,
      occurredAt: new Date(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown BookingCreated processing error.";

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
