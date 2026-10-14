import { Prisma } from "@/generated/prisma/client";
import { isObject, normaliseString } from "@/lib/autocab/booking-mappers";
import { persistBookingEvent } from "@/lib/autocab/booking-event-persistence";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { type BookingOperationalStatus } from "@/lib/autocab/booking-state";
import { normaliseEventType, webhookOccurredAt } from "@/lib/autocab/webhook-processing";
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
  // The shared database is owned by Need A Cab Plus after the source cutover.
  // Its registry sync supplies accounts; TaxiCRM must not call Autocab itself.
  if (process.env.AUTOCAB_REST_INGEST_DISABLED === 'true') return;
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

/** CRM-owned effects that run after the canonical booking transaction commits. */
export async function runBookingPostCommitEffects(
  webhookEventId: string,
): Promise<void> {
  const event = await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: {
      status: true,
      eventType: true,
      bookingId: true,
      payload: true,
      receivedAt: true,
    },
  });
  if (!event || event.status !== "PROCESSED" || !event.bookingId) {
    throw new Error("Processed booking event is unavailable for CRM effects.");
  }
  if (!new Set([
    "bookingcreated", "bookingdispatched", "bookingdispatchaccepted",
    "bookingarrived", "bookingpob", "bookingcomplete", "bookingnofare",
    "bookingcancelled", "bookingrejected", "bookingrecovered",
  ]).has(normaliseEventType(event.eventType))) {
    throw new Error("Booking event has no CRM post-commit effects.");
  }

  await reconcileUnknownAutocabAccount(
    event.payload as Record<string, unknown>,
  );
  await refreshCustomerPredictionBestEffort(event.bookingId);
  await enrichBookingLocationsBestEffort(event.bookingId);
  const metric = await buildCompanyDailyMetrics(webhookOccurredAt(event));
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
}

export async function processBookingWebhook(
  webhookEventId: string,
  options: ProcessBookingWebhookOptions,
  tx: Prisma.TransactionClient,
): Promise<WebhookAfterCommit> {
  await persistBookingEvent(
    tx,
    webhookEventId,
    options,
  );
  return () => runBookingPostCommitEffects(webhookEventId);
}
