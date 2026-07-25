import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingNoFareWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "No Fare",
    description: "Booking ended without a fare.",
    status: "NO_FARE",
    unknownErrorMessage: "Unknown BookingNoFare processing error.",
  });
}
