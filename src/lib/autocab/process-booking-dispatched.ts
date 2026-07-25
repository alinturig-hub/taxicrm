import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingDispatchedWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Booking Dispatched",
    description: "Booking dispatched to a driver.",
    status: "DISPATCHED",
    unknownErrorMessage: "Unknown BookingDispatched processing error.",
  });
}
