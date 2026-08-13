import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function normaliseEmail(value: string | null) {
  return value?.trim().toLowerCase() || null;
}

function normaliseTelephone(value: string | null) {
  return value?.trim() || null;
}

export async function GET() {
  try {
    const [accountCustomers, bookings] = await Promise.all([
      prisma.autocabAccount.findMany({
        where: {
          provider: "AUTOCAB",
          active: true,
        },
        orderBy: {
          displayName: "asc",
        },
        select: {
          id: true,
          externalId: true,
          accountCode: true,
          displayName: true,
          accountType: true,
          active: true,
          suspended: true,
          suspendedReason: true,
          companyName: true,
          contactName: true,
          telephone: true,
          email: true,
          lastSyncedAt: true,
        },
      }),

      prisma.booking.findMany({
        where: {
          OR: [
            {
              telephoneNumber: {
                not: null,
              },
            },
            {
              customerEmail: {
                not: null,
              },
            },
          ],
        },
        orderBy: [
          {
            bookedAtTime: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        select: {
          id: true,
          customerName: true,
          telephoneNumber: true,
          customerEmail: true,
          accountId: true,
          accountCode: true,
          accountName: true,
          bookedAtTime: true,
          createdAt: true,
        },
      }),
    ]);

    const normalCustomerMap = new Map<
      string,
      {
        key: string;
        name: string | null;
        telephoneNumber: string | null;
        email: string | null;
        totalBookings: number;
        lastBookingAt: Date | null;
      }
    >();

    for (const booking of bookings) {
      if (
        booking.accountId ||
        booking.accountCode ||
        booking.accountName
      ) {
        continue;
      }

      const telephone =
        normaliseTelephone(booking.telephoneNumber);
      const email =
        normaliseEmail(booking.customerEmail);

      const key = telephone
        ? `tel:${telephone}`
        : email
          ? `email:${email}`
          : null;

      if (!key) {
        continue;
      }

      const bookingDate =
        booking.bookedAtTime ?? booking.createdAt;

      const existing =
        normalCustomerMap.get(key);

      if (!existing) {
        normalCustomerMap.set(key, {
          key,
          name: booking.customerName,
          telephoneNumber: telephone,
          email,
          totalBookings: 1,
          lastBookingAt: bookingDate,
        });

        continue;
      }

      existing.totalBookings += 1;

      if (
        !existing.name &&
        booking.customerName
      ) {
        existing.name = booking.customerName;
      }

      if (
        !existing.email &&
        email
      ) {
        existing.email = email;
      }

      if (
        !existing.telephoneNumber &&
        telephone
      ) {
        existing.telephoneNumber = telephone;
      }

      if (
        !existing.lastBookingAt ||
        bookingDate > existing.lastBookingAt
      ) {
        existing.lastBookingAt = bookingDate;
      }
    }

    const normalCustomers = Array.from(
      normalCustomerMap.values(),
    ).sort((a, b) => {
      const aTime =
        a.lastBookingAt?.getTime() ?? 0;
      const bTime =
        b.lastBookingAt?.getTime() ?? 0;

      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      summary: {
        accountCustomers: accountCustomers.length,
        normalCustomers: normalCustomers.length,
        total:
          accountCustomers.length +
          normalCustomers.length,
      },
      accountCustomers,
      normalCustomers,
    });
  } catch (error) {
    console.error(
      "Customers dashboard request failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Customers could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}
