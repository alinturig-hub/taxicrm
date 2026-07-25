import { processBookingWebhook } from "@/lib/autocab/process-booking-webhook";

export async function processBookingDispatchAcceptedWebhook(
  webhookEventId: string,
): Promise<void> {
  return processBookingWebhook(webhookEventId, {
    title: "Dispatch Accepted",
    description: "Driver accepted the booking dispatch.",
    status: "ACCEPTED",
    unknownErrorMessage:
      "Unknown BookingDispatchAccepted processing error.",
  });
}
