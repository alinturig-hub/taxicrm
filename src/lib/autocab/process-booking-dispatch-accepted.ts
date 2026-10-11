import { Prisma } from "@/generated/prisma/client";
import type { WebhookAfterCommit } from "@/lib/autocab/webhook-processing";
import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingDispatchAcceptedWebhook(
  webhookEventId: string,
  tx: Prisma.TransactionClient,
): Promise<void | WebhookAfterCommit> {
  return processBookingWebhook(
    webhookEventId,
    {
      title: "Dispatch Accepted",
      description: "Driver accepted the booking dispatch.",
      status: "ACCEPTED",
      unknownErrorMessage: "Unknown BookingDispatchAccepted processing error.",
    },
    tx,
  );
}
