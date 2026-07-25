import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingCancelledWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Booking Cancelled",
    description: "Booking was cancelled.",
    status: "CANCELLED",
    unknownErrorMessage: "Unknown BookingCancelled processing error.",
  });
}
