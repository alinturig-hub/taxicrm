import { Prisma } from "@/generated/prisma/client";
import { isObject, normaliseString } from "@/lib/autocab/booking-mappers";
import { persistBookingEvent } from "@/lib/autocab/booking-event-persistence";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { type BookingOperationalStatus } from "@/lib/autocab/booking-state";
import { buildCompanyDailyMetrics } from "@/lib/analytics/build-company-daily-metrics";
import { refreshCustomerBookingPrediction } from "@/lib/customers/customer-booking-predictions";
import { prisma } from "@/lib/prisma";
import { enrichBookingLocation } from "@/lib/places/geoapify-place-enrichment";
import { broadcastDashboardMetricUpdate } from "@/lib/realtime/dashboard-broadcast";
import { syncAutocabAccounts } from "@/lib/integrations/autocab/account-sync/sync";

async function refreshCustomerPredictionBestEffort(
  bookingId: string,
): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
      select: {
        normalCustomerId: true,
      },
    });

    if (!booking?.normalCustomerId) {
      return;
    }

    await refreshCustomerBookingPrediction(booking.normalCustomerId, {
      triggerBookingId: bookingId,
    });
  } catch (error) {
    console.error(
      `Automatic customer prediction refresh failed for booking ${bookingId}:`,
      error,
    );
  }
}

async function enrichBookingLocationsBestEffort(
  bookingId: string,
): Promise<void> {
  const locations = await prisma.bookingLocation.findMany({
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
      await enrichBookingLocation(location.id);
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

  const accountExternalId = normaliseString(accountPayload.Id);

  if (!accountExternalId) {
    return;
  }

  const existing = await prisma.autocabAccount.findUnique({
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
  tx: Prisma.TransactionClient,
): Promise<WebhookAfterCommit> {
  const { bookingId, event, occurredAt } = await persistBookingEvent(
    tx,
    webhookEventId,
    options,
  );
  return async () => {
    await reconcileUnknownAutocabAccount(
      event.payload as Record<string, unknown>,
    );
    await refreshCustomerPredictionBestEffort(bookingId);
    await enrichBookingLocationsBestEffort(bookingId);
    const metric = await buildCompanyDailyMetrics(occurredAt);
    broadcastDashboardMetricUpdate({
      date: metric.date.toISOString(),
      revenue: Number(metric.revenue),
      cashRevenue: Number(metric.cashRevenue),
      accountRevenue: Number(metric.accountRevenue),
      cardRevenue: Number(metric.cardRevenue),
      bookings: metric.bookings,
      completed: metric.completed,
      cancelled: metric.cancelled,
      noFare: metric.noFare,
      rejected: metric.rejected,
      completionRate: Number(metric.completionRate),
      updatedAt: metric.updatedAt.toISOString(),
    });
  };
}
