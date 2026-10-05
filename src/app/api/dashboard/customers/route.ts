import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session =
    await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const [
      accountCustomers,
      normalCustomerRecords,
      allBehaviourTags,
      bookingCountRecords,
      availableTagRecords,
    ] =
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

        // Flat customer rows only (no nested relations):
        // loading nested relations here emits an IN(...) with one
        // parameter per customer (68k+), exceeding PostgreSQL's
        // 65,535 parameter limit. Relations are fetched in bulk below.
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
          },
        }),

        // All active behaviour tags in a single flat query (no IN).
        prisma.customerBehaviourTag.findMany({
          where: {
            active: true,
          },
          orderBy: {
            label: "asc",
          },
          select: {
            normalCustomerId: true,
            tagId: true,
            label: true,
            category: true,
            confidence: true,
            evidenceCount: true,
            eligibleCount: true,
            percentage: true,
          },
        }),

        // Booking count per customer in a single GROUP BY (no IN).
        prisma.booking.groupBy({
          by: ["normalCustomerId"],
          _count: {
            _all: true,
          },
        }),

        prisma.customerBehaviourTag.groupBy({
          by: [
            "tagId",
            "label",
            "category",
          ],
          where: {
            active: true,
          },
          _count: {
            _all: true,
          },
          orderBy: {
            tagId: "asc",
          },
        }),
      ]);

    const tagsByCustomer = new Map<
      string,
      {
        id: string;
        label: string;
        category: string;
        confidence: string;
        evidenceCount: number;
        eligibleCount: number;
        percentage: number;
      }[]
    >();

    for (const tag of allBehaviourTags) {
      const entry = tagsByCustomer.get(
        tag.normalCustomerId,
      );
      if (entry) {
        entry.push({
          id: tag.tagId,
          label: tag.label,
          category: tag.category,
          confidence: tag.confidence,
          evidenceCount: tag.evidenceCount,
          eligibleCount: tag.eligibleCount,
          percentage: tag.percentage.toNumber(),
        });
      } else {
        tagsByCustomer.set(tag.normalCustomerId, [
          {
            id: tag.tagId,
            label: tag.label,
            category: tag.category,
            confidence: tag.confidence,
            evidenceCount: tag.evidenceCount,
            eligibleCount: tag.eligibleCount,
            percentage: tag.percentage.toNumber(),
          },
        ]);
      }
    }

    const bookingsByCustomer = new Map<
      string,
      number
    >();
    for (const row of bookingCountRecords) {
      if (row.normalCustomerId !== null) {
        bookingsByCustomer.set(
          row.normalCustomerId,
          row._count._all,
        );
      }
    }

    const normalCustomers =
      normalCustomerRecords.map((customer) => ({
        key: customer.id,
        name: customer.displayName,
        telephoneNumber:
          customer.telephoneNumber,
        email: customer.email,
        totalBookings:
          bookingsByCustomer.get(customer.id) ?? 0,
        firstBookingAt:
          customer.firstBookingAt,
        lastBookingAt:
          customer.lastBookingAt,
        tags:
          tagsByCustomer.get(customer.id) ?? [],
      }));

    const availableTags =
      availableTagRecords.map(
        (tag) => ({
          id: tag.tagId,
          label: tag.label,
          category: tag.category,
          customers:
            tag._count._all,
        }),
      );

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
      availableTags,
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
