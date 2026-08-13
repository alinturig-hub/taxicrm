import { Prisma } from "@/generated/prisma/client";

import {
  normaliseString,
  type JsonObject,
} from "@/lib/autocab/booking-mappers";

function normaliseTelephone(
  value: unknown,
): string | null {
  const telephone = normaliseString(value);

  if (!telephone) {
    return null;
  }

  return telephone.replace(/\s+/g, "");
}

export async function synchroniseNormalCustomer(
  tx: Prisma.TransactionClient,
  bookingId: string,
  payload: JsonObject,
): Promise<void> {
  const account =
    typeof payload.Account === "object" &&
    payload.Account !== null &&
    !Array.isArray(payload.Account)
      ? payload.Account
      : null;

  if (account) {
    return;
  }

  const telephone =
    normaliseTelephone(
      payload.TelephoneNumber,
    );

  if (!telephone) {
    return;
  }

  const displayTelephone =
    normaliseString(
      payload.TelephoneNumber,
    ) ?? telephone;

  const displayName =
    normaliseString(payload.Name);

  const email =
    normaliseString(
      payload.CustomerEmail,
    );

  const booking =
    await tx.booking.findUnique({
      where: {
        id: bookingId,
      },
      select: {
        bookedAtTime: true,
        createdAt: true,
      },
    });

  const bookingDate =
    booking?.bookedAtTime ??
    booking?.createdAt ??
    new Date();

  const customer =
    await tx.normalCustomer.upsert({
      where: {
        normalizedTelephone: telephone,
      },
      create: {
        normalizedTelephone: telephone,
        telephoneNumber: displayTelephone,
        displayName,
        email,
        firstBookingAt: bookingDate,
        lastBookingAt: bookingDate,
      },
      update: {
        telephoneNumber: displayTelephone,
        ...(displayName
          ? { displayName }
          : {}),
        ...(email
          ? { email }
          : {}),
        lastBookingAt: bookingDate,
      },
      select: {
        id: true,
      },
    });

  await tx.booking.updateMany({
    where: {
      telephoneNumber: displayTelephone,
      normalCustomerId: null,
      accountId: null,
      accountCode: null,
      accountName: null,
    },
    data: {
      normalCustomerId: customer.id,
    },
  });
}
