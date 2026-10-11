import { Prisma } from "@/generated/prisma/client";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingCreatedWebhook(
  webhookEventId: string,
  tx: Prisma.TransactionClient,
): Promise<void | WebhookAfterCommit> {
  return processBookingWebhook(
    webhookEventId,
    {
      title: "Booking Created",
      description: "Booking created in Autocab.",
      status: "CREATED",
      unknownErrorMessage: "Unknown BookingCreated processing error.",
    },
    tx,
  );
}
