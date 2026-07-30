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

const activeStatusPriority: Partial<
  Record<BookingOperationalStatus, number>
> = {
  CREATED: 1,
  DISPATCHED: 2,
  ACCEPTED: 3,
  ARRIVED: 4,
  POB: 5,
};

const terminalStatuses = new Set<BookingOperationalStatus>([
  "COMPLETED",
  "CANCELLED",
  "NO_FARE",
  "REJECTED",
]);

function isTerminalStatus(
  status: BookingOperationalStatus,
): boolean {
  return terminalStatuses.has(status);
}

function canTransitionBookingStatus(
  currentStatus: BookingOperationalStatus,
  nextStatus: BookingOperationalStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return false;
  }

  /*
   * A final status cannot be replaced by a delayed or duplicated webhook.
   * The rest of the booking payload is still processed by upsertBooking().
   */
  if (isTerminalStatus(currentStatus)) {
    return false;
  }

  /*
   * An active booking may finish from any operational stage.
   */
  if (isTerminalStatus(nextStatus)) {
    return true;
  }

  const currentPriority = activeStatusPriority[currentStatus];
  const nextPriority = activeStatusPriority[nextStatus];

  if (
    currentPriority === undefined ||
    nextPriority === undefined
  ) {
    return false;
  }

  /*
   * Only forward movement is allowed.
   * Skipped intermediary webhooks are accepted, for example:
   * DISPATCHED -> ARRIVED.
   */
  return nextPriority > currentPriority;
}

export async function updateBookingStatus(
  tx: Prisma.TransactionClient,
  bookingId: string,
  nextStatus: BookingOperationalStatus,
): Promise<void> {
  const booking = await tx.booking.findUnique({
    where: {
      id: bookingId,
    },
    select: {
      status: true,
    },
  });

  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }

  const currentStatus =
    booking.status.toUpperCase() as BookingOperationalStatus;

  if (!canTransitionBookingStatus(currentStatus, nextStatus)) {
    return;
  }

  await tx.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      status: nextStatus,
    },
  });
}
