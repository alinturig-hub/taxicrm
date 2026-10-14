import { Prisma } from "@/generated/prisma/client";
import { AUTOCAB_EVENT_REGISTRY } from "@/lib/autocab/event-registry";
import { normaliseEventType } from "@/lib/autocab/webhook-processing";
import { prisma } from "@/lib/prisma";
import { shouldProcessWebhookLocally } from "@/lib/autocab/booking-writer-ownership";

async function lockEvent(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "WebhookEvent" WHERE "id" = ${id} FOR UPDATE`;
}

export async function processWebhookEvent(
  webhookEventId: string,
): Promise<void> {
  let afterCommit;
  try {
    afterCommit = await prisma.$transaction(
      async (tx) => {
        // Concurrent workers wait, then see the committed result rather than replaying it.
        await lockEvent(tx, webhookEventId);
        const event = await tx.webhookEvent.findUnique({
          where: { id: webhookEventId },
          include: { webhookConfiguration: true },
        });
        if (!event)
          throw new Error(`WebhookEvent not found: ${webhookEventId}`);
        // Leave raw Booking events untouched for the exclusive NAC worker.
        // This guard also covers direct callers outside the periodic processor.
        if (!shouldProcessWebhookLocally(event.eventType)) return;
        if (event.status === "PROCESSED" || event.status === "IGNORED") return;
        const definition = Array.from(AUTOCAB_EVENT_REGISTRY.values()).find(
          (item) =>
            normaliseEventType(item.eventType) ===
            normaliseEventType(event.eventType),
        );
        if (!event.webhookConfiguration?.isEnabled || !definition?.handler) {
          await tx.webhookEvent.update({
            where: { id: event.id },
            data: {
              status: "IGNORED",
              processedAt: new Date(),
              processingError: !definition?.handler
                ? "No handler registered for event type."
                : null,
            },
          });
          return;
        }
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "PROCESSING",
            processingError: null,
            attemptCount: { increment: 1 },
          },
        });
        const effect = await definition.handler(event.id, tx);
        await tx.webhookEvent.update({
          where: { id: event.id },
          data: {
            status: "PROCESSED",
            processingError: null,
            processedAt: new Date(),
          },
        });
        return effect;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  } catch (error) {
    // Failed domain effects and attempt increments rolled back. Lock again so
    // a concurrent successful retry cannot be overwritten with FAILED.
    await prisma.$transaction(async (tx) => {
      await lockEvent(tx, webhookEventId);
      await tx.webhookEvent.updateMany({
        where: {
          id: webhookEventId,
          status: { notIn: ["PROCESSED", "IGNORED"] },
        },
        data: {
          status: "FAILED",
          processedAt: null,
          attemptCount: { increment: 1 },
          processingError: (error instanceof Error
            ? error.message
            : "Unknown webhook processing error."
          ).slice(0, 5000),
        },
      });
    });
    throw error;
  }
  // Optional effects must not replay durable effects after commit.
  if (afterCommit) {
    try {
      await afterCommit();
    } catch (error) {
      console.error(
        `Webhook ${webhookEventId} post-commit effect failed:`,
        error,
      );
    }
  }
}
