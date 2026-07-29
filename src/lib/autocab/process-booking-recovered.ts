import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingRecoveredWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Booking Recovered",
    description: "Booking recovered and returned to the dispatch workflow.",
    status: "DISPATCHED",
    unknownErrorMessage: "Unknown BookingRecovered processing error.",
  });
}
