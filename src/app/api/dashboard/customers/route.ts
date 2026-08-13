import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [accountCustomers, normalCustomerRecords] =
      await Promise.all([
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

        prisma.normalCustomer.findMany({
          orderBy: [
            {
              lastBookingAt: "desc",
            },
            {
              displayName: "asc",
            },
          ],
          select: {
            id: true,
            displayName: true,
            telephoneNumber: true,
            email: true,
            firstBookingAt: true,
            lastBookingAt: true,
            _count: {
              select: {
                bookings: true,
              },
            },
          },
        }),
      ]);

    const normalCustomers =
      normalCustomerRecords.map((customer) => ({
        key: customer.id,
        name: customer.displayName,
        telephoneNumber:
          customer.telephoneNumber,
        email: customer.email,
        totalBookings:
          customer._count.bookings,
        firstBookingAt:
          customer.firstBookingAt,
        lastBookingAt:
          customer.lastBookingAt,
      }));

    return NextResponse.json({
      success: true,
      summary: {
        accountCustomers:
          accountCustomers.length,
        normalCustomers:
          normalCustomers.length,
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
