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
) {
  const existing = await tx.booking.findUnique({
    where: {
      provider_externalId: {
        provider: "AUTOCAB",
        externalId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    const booking = await tx.booking.create({
      data: buildBookingCreateData(payload, externalId),
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

  await tx.booking.update({
    where: {
      id: existing.id,
    },
    data: buildBookingUpdateData(payload),
  });

  await synchroniseLocation(
    tx,
    existing.id,
    payload,
    "Pickup",
    "PICKUP",
  );

  await synchroniseLocation(
    tx,
    existing.id,
    payload,
    "Destination",
    "DESTINATION",
  );

  await synchroniseVias(
    tx,
    existing.id,
    payload,
  );

  return existing.id;
}
