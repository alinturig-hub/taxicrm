import { prisma } from "@/lib/prisma";
import { getBookingDiff } from "@/lib/services/booking-diff-service";

export async function getBookingHistory(bookingId: string) {
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
          eventType: true,
          receivedAt: true,
        },
      },
    },
  });

  return snapshots.map((snapshot, index) => {
    const previous = index === 0 ? null : snapshots[index - 1];

    return {
      version: snapshot.version,
      eventType: snapshot.eventType,
      timestamp:
        snapshot.webhookEvent?.receivedAt ?? snapshot.createdAt,
      changes: previous
        ? getBookingDiff(previous.snapshot, snapshot.snapshot)
        : [],
      snapshot,
    };
  });
}
