import { Prisma } from "@/generated/prisma/client";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { processBookingContextWebhook } from "@/lib/autocab/process-booking-context-webhook";

export async function processBookingModifiedWebhook(
  webhookEventId: string,
  tx: Prisma.TransactionClient,
): Promise<void | WebhookAfterCommit> {
  return processBookingContextWebhook(
    webhookEventId,
    {
      title: "Booking Modified",
      description: "Booking modified in Autocab.",
      unknownErrorMessage: "Unknown BookingModified processing error.",
    },
    tx,
  );
}
