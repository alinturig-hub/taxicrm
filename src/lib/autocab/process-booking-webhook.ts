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
import { buildCompanyDailyMetrics } from "@/lib/analytics/build-company-daily-metrics";
import { prisma } from "@/lib/prisma";
import { enrichBookingLocation } from "@/lib/places/geoapify-place-enrichment";
import { broadcastDashboardMetricUpdate } from "@/lib/realtime/dashboard-broadcast";
import { createBookingSnapshot } from "@/lib/services/booking-snapshot-service";
import { appendBookingTimelineEvent } from "@/lib/services/booking-timeline-service";
import { syncAutocabAccounts } from "@/lib/integrations/autocab/account-sync/sync";

async function enrichBookingLocationsBestEffort(
  bookingId: string,
): Promise<void> {
  const locations =
    await prisma.bookingLocation.findMany({
      where: {
        bookingId,
        latitude: {
          not: null,
        },
        longitude: {
          not: null,
        },
      },
      orderBy: {
        type: "asc",
      },
      select: {
        id: true,
        type: true,
      },
    });

  for (const location of locations) {
    try {
      await enrichBookingLocation(
        location.id,
      );
    } catch (error) {
      console.error(
        `Automatic Geoapify enrichment failed for ${location.type} location ${location.id}:`,
        error,
      );
    }
  }
}

async function reconcileUnknownAutocabAccount(
  payload: Record<string, unknown>,
): Promise<void> {
  const accountPayload = payload.Account;

  if (!isObject(accountPayload)) {
    return;
  }

  const accountExternalId =
    normaliseString(accountPayload.Id);

  if (!accountExternalId) {
    return;
  }

  const existing =
    await prisma.autocabAccount.findUnique({
      where: {
        provider_externalId: {
          provider: "AUTOCAB",
          externalId: accountExternalId,
        },
      },
      select: {
        id: true,
      },
    });

  if (existing) {
    return;
  }

  try {
    console.info(
      `Unknown Autocab account ${accountExternalId} detected from booking webhook. Starting account reconciliation.`,
    );

    await syncAutocabAccounts("WEBHOOK");
  } catch (error) {
    console.error(
      `Autocab account reconciliation failed for account ${accountExternalId}:`,
      error,
    );
  }
}

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
      receivedAt: true,
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

      if (options.status === "ACCEPTED") {
        await tx.booking.updateMany({
          where: {
            id,
            acceptedAt: null,
          },
          data: {
            acceptedAt: webhookEvent.receivedAt,
          },
        });
      }

      if (options.status === "CANCELLED") {
        await tx.booking.updateMany({
          where: {
            id,
            cancelledAt: null,
          },
          data: {
            cancelledAt: webhookEvent.receivedAt,
          },
        });
      }

      if (options.status === "NO_FARE") {
        await tx.booking.updateMany({
          where: {
            id,
            noFareAt: null,
          },
          data: {
            noFareAt: webhookEvent.receivedAt,
          },
        });
      }

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

    await reconcileUnknownAutocabAccount(
      payload,
    );

    await enrichBookingLocationsBestEffort(
      bookingId,
    );

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

    const metric = await buildCompanyDailyMetrics(
      webhookEvent.receivedAt,
    );

    broadcastDashboardMetricUpdate({
      date: metric.date.toISOString(),
      revenue: Number(metric.revenue),
      cashRevenue: Number(metric.cashRevenue),
      accountRevenue: Number(
        metric.accountRevenue,
      ),
      cardRevenue: Number(metric.cardRevenue),
      bookings: metric.bookings,
      completed: metric.completed,
      cancelled: metric.cancelled,
      noFare: metric.noFare,
      rejected: metric.rejected,
      completionRate: Number(
        metric.completionRate,
      ),
      updatedAt: metric.updatedAt.toISOString(),
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
