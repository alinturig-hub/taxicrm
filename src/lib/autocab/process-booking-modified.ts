import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingModifiedWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Booking Modified",
    description: "Booking modified in Autocab.",
    unknownErrorMessage: "Unknown BookingModified processing error.",
  });
}
