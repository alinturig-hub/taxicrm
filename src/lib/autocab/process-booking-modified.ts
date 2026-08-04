import { processBookingContextWebhook } from "@/lib/autocab/process-booking-context-webhook";

export async function processBookingModifiedWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingContextWebhook(webhookEventId, {
    title: "Booking Modified",
    description: "Booking modified in Autocab.",
    unknownErrorMessage: "Unknown BookingModified processing error.",
  });
}
