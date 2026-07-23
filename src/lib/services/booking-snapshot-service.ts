import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_VERSION_RETRIES = 3;

export type CreateBookingSnapshotInput = {
  bookingId: string;
  webhookEventId?: string | null;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isVersionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function createBookingSnapshot({
  bookingId,
  webhookEventId = null,
}: CreateBookingSnapshotInput) {
  const [booking, webhookEvent] = await Promise.all([
    prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
      include: {
        locations: true,
        vias: true,
        timelineEvents: true,
      },
    }),
    webhookEventId
      ? prisma.webhookEvent.findUnique({
          where: {
            id: webhookEventId,
          },
          select: {
            id: true,
            eventType: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  if (webhookEventId && !webhookEvent) {
    throw new Error(`WebhookEvent not found: ${webhookEventId}`);
  }

  const snapshot = toJsonValue(booking);
  const eventType = webhookEvent?.eventType ?? "SYSTEM";

  for (let attempt = 1; attempt <= MAX_VERSION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const latestSnapshot = await transaction.bookingSnapshot.aggregate({
          where: {
            bookingId,
          },
          _max: {
            version: true,
          },
        });

        const version = (latestSnapshot._max.version ?? 0) + 1;

        return transaction.bookingSnapshot.create({
          data: {
            bookingId,
            webhookEventId,
            version,
            eventType,
            snapshot,
          },
        });
      });
    } catch (error) {
      if (isVersionConflict(error) && attempt < MAX_VERSION_RETRIES) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Could not create snapshot for booking: ${bookingId}`);
}
