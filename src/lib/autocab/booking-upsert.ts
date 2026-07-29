import { Prisma } from "@/generated/prisma/client";

import {
  buildBookingCreateData,
  buildBookingUpdateData,
  type JsonObject,
} from "@/lib/autocab/booking-mappers";
import {
  synchroniseLocation,
  synchroniseVias,
} from "@/lib/autocab/booking-synchronisers";

export async function upsertBooking(
  tx: Prisma.TransactionClient,
  externalId: string,
  payload: JsonObject,
): Promise<string> {
  const booking = await tx.booking.upsert({
    where: {
      provider_externalId: {
        provider: "AUTOCAB",
        externalId,
      },
    },
    create: buildBookingCreateData(payload, externalId),
    update: buildBookingUpdateData(payload),
    select: {
      id: true,
    },
  });

  await synchroniseLocation(
    tx,
    booking.id,
    payload,
    "Pickup",
    "PICKUP",
  );

  await synchroniseLocation(
    tx,
    booking.id,
    payload,
    "Destination",
    "DESTINATION",
  );

  await synchroniseVias(
    tx,
    booking.id,
    payload,
  );

  return booking.id;
}
