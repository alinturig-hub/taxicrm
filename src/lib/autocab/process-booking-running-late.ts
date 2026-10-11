import { Prisma } from "@/generated/prisma/client";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { processBookingContextWebhook } from "@/lib/autocab/process-booking-context-webhook";

export async function processBookingRunningLateWebhook(
  webhookEventId: string,
  tx: Prisma.TransactionClient,
): Promise<void | WebhookAfterCommit> {
  return processBookingContextWebhook(
    webhookEventId,
    {
      title: "Booking Running Late",
      description: "Booking reported as running late by Autocab.",
      unknownErrorMessage: "Unknown BookingRunningLate processing error.",
    },
    tx,
  );
}
