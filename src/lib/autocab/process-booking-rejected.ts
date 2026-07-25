import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingRejectedWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Booking Rejected",
    description: "Booking dispatch was rejected.",
    status: "REJECTED",
    unknownErrorMessage: "Unknown BookingRejected processing error.",
  });
}
