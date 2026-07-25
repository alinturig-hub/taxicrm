import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingCreatedWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Booking Created",
    description: "Booking created in Autocab.",
    unknownErrorMessage: "Unknown BookingCreated processing error.",
  });
}
