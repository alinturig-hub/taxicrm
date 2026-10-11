import { Prisma } from "@/generated/prisma/client";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingArrivedWebhook(
  webhookEventId: string,
  tx: Prisma.TransactionClient,
): Promise<void | WebhookAfterCommit> {
  return processBookingWebhook(
    webhookEventId,
    {
      title: "Driver Arrived",
      description: "Driver arrived at the pickup location.",
      status: "ARRIVED",
      unknownErrorMessage: "Unknown BookingArrived processing error.",
    },
    tx,
  );
}
