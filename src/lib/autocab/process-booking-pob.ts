import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingPOBWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Passenger On Board",
    description: "Passenger boarded the vehicle.",
    status: "POB",
    unknownErrorMessage: "Unknown BookingPOB processing error.",
  });
}
