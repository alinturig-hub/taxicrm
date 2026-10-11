import { Prisma } from "@/generated/prisma/client";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingDispatchedWebhook(
  webhookEventId: string,
  tx: Prisma.TransactionClient,
): Promise<void | WebhookAfterCommit> {
  return processBookingWebhook(
    webhookEventId,
    {
      title: "Booking Dispatched",
      description: "Booking dispatched to a driver.",
      status: "DISPATCHED",
      unknownErrorMessage: "Unknown BookingDispatched processing error.",
    },
    tx,
  );
}
