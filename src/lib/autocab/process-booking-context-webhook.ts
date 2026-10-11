import { Prisma } from "@/generated/prisma/client";
import { persistBookingEvent } from "@/lib/autocab/booking-event-persistence";

type ProcessBookingContextWebhookOptions = {
  title: string;
  description: string;
  unknownErrorMessage: string;
};

export async function processBookingContextWebhook(
  webhookEventId: string,
  options: ProcessBookingContextWebhookOptions,
  tx: Prisma.TransactionClient,
): Promise<void> {
  await persistBookingEvent(tx, webhookEventId, options);
}
