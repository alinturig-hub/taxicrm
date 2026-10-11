import { Prisma } from "@/generated/prisma/client";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingNoFareWebhook(
  webhookEventId: string,
  tx: Prisma.TransactionClient,
): Promise<void | WebhookAfterCommit> {
  return processBookingWebhook(
    webhookEventId,
    {
      title: "No Fare",
      description: "Booking ended without a fare.",
      status: "NO_FARE",
      unknownErrorMessage: "Unknown BookingNoFare processing error.",
    },
    tx,
  );
}
