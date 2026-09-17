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
            behaviourTags: {
              where: {
                active: true,
              },
              orderBy: {
                label: "asc",
              },
              select: {
                tagId: true,
                label: true,
                category: true,
                confidence: true,
                evidenceCount: true,
                eligibleCount: true,
                percentage: true,
              },
            },
            _count: {
              select: {
                bookings: true,
              },
            },
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
        tags:
          customer.behaviourTags.map(
            (tag) => ({
              id: tag.tagId,
              label: tag.label,
              category: tag.category,
              confidence:
                tag.confidence,
              evidenceCount:
                tag.evidenceCount,
              eligibleCount:
                tag.eligibleCount,
              percentage:
                tag.percentage.toNumber(),
            }),
          ),
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
