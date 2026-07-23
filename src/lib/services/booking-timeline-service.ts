import { prisma } from "@/lib/prisma";

export async function getBookingTimeline(bookingId: string) {
  const snapshots = await prisma.bookingSnapshot.findMany({
    where: {
      bookingId,
    },
    orderBy: {
      version: "asc",
    },
    include: {
      webhookEvent: {
        select: {
          id: true,
          eventType: true,
          receivedAt: true,
        },
      },
    },
  });

  return snapshots.map((snapshot) => ({
    version: snapshot.version,
    eventType: snapshot.eventType,
    timestamp:
      snapshot.webhookEvent?.receivedAt ?? snapshot.createdAt,
    webhookEventId: snapshot.webhookEventId,
    snapshotId: snapshot.id,
  }));
}
