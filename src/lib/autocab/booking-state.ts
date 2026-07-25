import { Prisma } from "@/generated/prisma/client";

export type BookingOperationalStatus =
  | "CREATED"
  | "DISPATCHED"
  | "ACCEPTED"
  | "ARRIVED"
  | "POB"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_FARE"
  | "REJECTED";

export async function updateBookingStatus(
  tx: Prisma.TransactionClient,
  bookingId: string,
  status: BookingOperationalStatus,
): Promise<void> {
  await tx.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      status,
    },
  });
}
