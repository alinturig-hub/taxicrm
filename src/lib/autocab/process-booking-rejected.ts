import { Prisma } from "@/generated/prisma/client";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingRejectedWebhook(
  webhookEventId: string,
  tx: Prisma.TransactionClient,
): Promise<void | WebhookAfterCommit> {
  return processBookingWebhook(
    webhookEventId,
    {
      title: "Booking Rejected",
      description: "Booking was rejected.",
      status: "REJECTED",
      unknownErrorMessage: "Unknown BookingRejected processing error.",
    },
    tx,
  );
}
