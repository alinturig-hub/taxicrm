import {
  AUTOCAB_EVENT_REGISTRY,
} from "@/lib/autocab/event-registry";
import { prisma } from "@/lib/prisma";

function normalizeEventType(eventType: string): string {
  return eventType.replaceAll(".", "").toLowerCase();
}

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

  const normalized = normalizeEventType(webhookEvent.eventType);

  const definition =
    AUTOCAB_EVENT_REGISTRY.get(webhookEvent.eventType) ??
    Array.from(AUTOCAB_EVENT_REGISTRY.values()).find(
      (event) => normalizeEventType(event.eventType) === normalized,
    );

  if (definition?.handler) {
    await definition.handler(webhookEvent.id);
    return;
  }

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
