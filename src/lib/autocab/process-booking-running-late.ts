import { processBookingContextWebhook } from "@/lib/autocab/process-booking-context-webhook";

export async function processBookingRunningLateWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingContextWebhook(webhookEventId, {
    title: "Booking Running Late",
    description: "Booking reported as running late by Autocab.",
    unknownErrorMessage:
      "Unknown BookingRunningLate processing error.",
  });
}
