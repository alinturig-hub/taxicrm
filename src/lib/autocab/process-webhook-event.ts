import { prisma } from "@/lib/prisma";
import { processBookingCreatedWebhook } from "./process-booking-created";

export async function processWebhookEvent(
  webhookEventId: string,
): Promise<void> {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: {
      id: webhookEventId,
    },
    select: {
      id: true,
      eventType: true,
      status: true,
    },
  });

  if (!webhookEvent) {
    throw new Error(`WebhookEvent not found: ${webhookEventId}`);
  }

  switch (webhookEvent.eventType.toLowerCase()) {
    case "booking.created":
    case "bookingcreated":
      await processBookingCreatedWebhook(webhookEvent.id);
      return;

    default:
      await prisma.webhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          status: "PROCESSED",
          processingError: null,
          processedAt: new Date(),
        },
      });

      console.info(
        `No handler registered for event type: ${webhookEvent.eventType}`,
      );
  }
}
