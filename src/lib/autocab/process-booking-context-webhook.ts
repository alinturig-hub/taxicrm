import { Prisma } from "@/generated/prisma/client";
import {
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

type ProcessBookingContextWebhookOptions = {
  title: string;
  description: string;
  unknownErrorMessage: string;
};

export async function processBookingContextWebhook(
  webhookEventId: string,
  options: ProcessBookingContextWebhookOptions,
): Promise<void> {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: {
      id: webhookEventId,
    },
    select: {
      id: true,
      eventType: true,
      status: true,
      payload: true,
      receivedAt: true,
    },
  });

  if (!webhookEvent) {
    throw new Error(`WebhookEvent not found: ${webhookEventId}`);
  }

  if (
    webhookEvent.status === "PROCESSED" ||
    webhookEvent.status === "IGNORED"
  ) {
    return;
  }

  if (!isObject(webhookEvent.payload)) {
    throw new Error("Webhook payload is not a JSON object.");
  }

  const payload = webhookEvent.payload;

  const externalId = normaliseString(
    payload.OriginalBookingId ?? payload.BookingId ?? payload.Id,
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
      const existingBooking = await tx.booking.findUnique({
        where: {
          provider_externalId: {
            provider: "AUTOCAB",
            externalId,
          },
        },
        select: {
          id: true,
        },
      });

      // BookingModified nu are voie să creeze un booking nou.
      if (!existingBooking) {
        await tx.webhookEvent.update({
          where: {
            id: webhookEvent.id,
          },
          data: {
            externalBookingId: externalId,
            status: "IGNORED",
            processingError:
              "Booking context event received before BookingCreated.",
            processedAt: new Date(),
          },
        });

        return null;
      }

      await tx.booking.update({
        where: {
          id: existingBooking.id,
        },
        data: buildBookingUpdateData(payload),
      });

      await synchroniseLocation(
        tx,
        existingBooking.id,
        payload,
        "Pickup",
        "PICKUP",
      );

      await synchroniseLocation(
        tx,
        existingBooking.id,
        payload,
        "Destination",
        "DESTINATION",
      );

      await synchroniseVias(
        tx,
        existingBooking.id,
        payload,
      );

      await tx.webhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          externalBookingId: externalId,
          bookingId: existingBooking.id,
          status: "PROCESSED",
          processingError: null,
          processedAt: new Date(),
        },
      });

      return existingBooking.id;
    });

    if (!bookingId) {
      return;
    }

    await createBookingSnapshot({
      bookingId,
      webhookEventId: webhookEvent.id,
    });

    await appendBookingTimelineEvent({
      bookingId,
      webhookEventId: webhookEvent.id,
      eventType: webhookEvent.eventType,
      title: options.title,
      description: options.description,
      metadata: payload as Prisma.InputJsonObject,
      occurredAt: webhookEvent.receivedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : options.unknownErrorMessage;

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
