import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AppendBookingTimelineEventInput = {
  bookingId: string;
  webhookEventId?: string | null;
  eventType: string;
  title: string;
  description?: string | null;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
};

export async function appendBookingTimelineEvent({
  bookingId,
  webhookEventId = null,
  eventType,
  title,
  description = null,
  metadata,
  occurredAt = new Date(),
}: AppendBookingTimelineEventInput) {
  if (webhookEventId) {
    const existing = await prisma.bookingTimelineEvent.findFirst({
      where: {
        webhookEventId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.bookingTimelineEvent.create({
    data: {
      bookingId,
      webhookEventId,
      eventType,
      title,
      description,
      metadata,
      occurredAt,
    },
  });
}
