import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingCompleteWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Booking Completed",
    description: "Booking completed successfully.",
    status: "COMPLETED",
    unknownErrorMessage: "Unknown BookingComplete processing error.",
  });
}
