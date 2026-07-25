import { Prisma } from "@/generated/prisma/client";
import {
  buildLocationData,
  getObject,
  hasOwn,
  type JsonObject,
} from "@/lib/autocab/booking-mappers";

type LocationType = "PICKUP" | "DESTINATION";

export async function synchroniseLocation(
  tx: Prisma.TransactionClient,
  bookingId: string,
  payload: JsonObject,
  payloadKey: "Pickup" | "Destination",
  type: LocationType,
): Promise<void> {
  if (!hasOwn(payload, payloadKey)) {
    return;
  }

  const location = getObject(payload, payloadKey);

  if (!location) {
    await tx.bookingLocation.deleteMany({
      where: {
        bookingId,
        type,
      },
    });

    return;
  }

  const data = buildLocationData(location);

  if (!data) {
    return;
  }

  await tx.bookingLocation.upsert({
    where: {
      bookingId_type: {
        bookingId,
        type,
      },
    },
    create: {
      bookingId,
      type,
      ...data,
    },
    update: data,
  });
}
