import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingArrivedWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Driver Arrived",
    description: "Driver arrived at the pickup location.",
    status: "ARRIVED",
    unknownErrorMessage: "Unknown BookingArrived processing error.",
  });
}
