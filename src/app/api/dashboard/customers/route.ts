import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const page = Math.max(
    1,
    parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      parseInt(
        searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE),
        10,
      ) || DEFAULT_PAGE_SIZE,
    ),
  );
  const search = (searchParams.get("search") ?? "").trim();
  const tag = searchParams.get("tag") ?? "ALL";
  const skip = (page - 1) * limit;

  try {
    const whereNormal: Record<string, unknown> = {};

    const andConditions: Record<string, unknown>[] = [];

    if (tag !== "ALL") {
      andConditions.push({
        behaviourTags: {
          some: {
            tagId: tag,
            active: true,
          },
        },
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          {
            displayName: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            telephoneNumber: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            behaviourTags: {
              some: {
                label: {
                  contains: search,
                  mode: "insensitive",
                },
                active: true,
              },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      whereNormal.AND = andConditions;
    }

    const [
      accountCustomers,
      normalCustomerPage,
      totalNormal,
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
          where: whereNormal,
          orderBy: [
            {
              lastBookingAt: "desc",
            },
            {
              displayName: "asc",
            },
          ],
          skip,
          take: limit,
          select: {
            id: true,
            displayName: true,
            telephoneNumber: true,
            email: true,
            firstBookingAt: true,
            lastBookingAt: true,
          },
        }),

        prisma.normalCustomer.count({
          where: whereNormal,
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

    // Fetch relations only for the customers on the current page
    // (the page customer IDs are a small set, so the IN(...) stays
    // far below PostgreSQL's parameter limit).
    const pageIds = normalCustomerPage.map(
      (customer) => customer.id,
    );

    const [allBehaviourTags, bookingCountRecords] =
      pageIds.length === 0
        ? [[], []]
        : await Promise.all([
            prisma.customerBehaviourTag.findMany({
              where: {
                active: true,
                normalCustomerId: {
                  in: pageIds,
                },
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
            prisma.booking.groupBy({
              by: ["normalCustomerId"],
              where: {
                normalCustomerId: {
                  in: pageIds,
                },
              },
              _count: {
                _all: true,
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

    for (const tagRow of allBehaviourTags) {
      const entry = tagsByCustomer.get(
        tagRow.normalCustomerId,
      );
      const mapped = {
        id: tagRow.tagId,
        label: tagRow.label,
        category: tagRow.category,
        confidence: tagRow.confidence,
        evidenceCount: tagRow.evidenceCount,
        eligibleCount: tagRow.eligibleCount,
        percentage: tagRow.percentage.toNumber(),
      };
      if (entry) {
        entry.push(mapped);
      } else {
        tagsByCustomer.set(tagRow.normalCustomerId, [
          mapped,
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
      normalCustomerPage.map((customer) => ({
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
        (tagRow) => ({
          id: tagRow.tagId,
          label: tagRow.label,
          category: tagRow.category,
          customers:
            tagRow._count._all,
        }),
      );

    return NextResponse.json({
      success: true,
      summary: {
        accountCustomers:
          accountCustomers.length,
        normalCustomers: totalNormal,
        total:
          accountCustomers.length + totalNormal,
      },
      pagination: {
        page,
        limit,
        total: totalNormal,
        totalPages: Math.ceil(totalNormal / limit),
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
