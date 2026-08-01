import { Prisma } from "@/generated/prisma/client";
import {
  isObject,
  normaliseString,
} from "@/lib/autocab/booking-mappers";
import { upsertBooking } from "@/lib/autocab/booking-upsert";
import {
  updateBookingStatus,
  type BookingOperationalStatus,
} from "@/lib/autocab/booking-state";
import { prisma } from "@/lib/prisma";
import { createBookingSnapshot } from "@/lib/services/booking-snapshot-service";
import { appendBookingTimelineEvent } from "@/lib/services/booking-timeline-service";

type ProcessBookingWebhookOptions = {
  title: string;
  description: string;
  unknownErrorMessage: string;
  status: BookingOperationalStatus;
};

export async function processBookingWebhook(
  webhookEventId: string,
  options: ProcessBookingWebhookOptions,
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
      const id = await upsertBooking(tx, externalId, payload);

      await updateBookingStatus(
        tx,
        id,
        options.status,
      );

      await tx.webhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          externalBookingId: externalId,
          bookingId: id,
          status: "PROCESSED",
          processingError: null,
          processedAt: new Date(),
        },
      });

      return id;
    });

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
      occurredAt: new Date(),
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
