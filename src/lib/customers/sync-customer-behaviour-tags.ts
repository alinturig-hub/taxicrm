import { prisma } from "@/lib/prisma";
import { buildCustomerProfile } from "@/lib/customers/customer-profiler";

const WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;
const PAGE_SIZE = 200;

export type CustomerTagSyncResult = {
  customersProcessed: number;
  customersWithTags: number;
  activeTags: number;
  tagsCreated: number;
  tagsUpdated: number;
  tagsDeactivated: number;
  failedCustomers: number;
  windowStartAt: Date;
  windowEndAt: Date;
};

const bookingSelection = {
  externalId: true,
  status: true,
  bookedAtTime: true,
  pickupDueTime: true,
  completedAt: true,
  price: true,
  distance: true,
  paymentType: true,
  bookingSource: true,
  locations: {
    select: {
      type: true,
      address: true,
      zoneName: true,
      placeIntelligence: {
        select: {
          category: true,
          categories: true,
          isSensitive: true,
          poiCategoryStatus: true,
        },
      },
    },
  },
} as const;

export async function syncCustomerBehaviourTags(
  options: {
    now?: Date;
    customerLimit?: number;
  } = {},
): Promise<CustomerTagSyncResult> {
  const now =
    options.now ?? new Date();
  const windowStartAt =
    new Date(
      now.getTime() -
        WINDOW_DAYS * DAY_MS,
    );
  const customerLimit =
    options.customerLimit === undefined
      ? null
      : Math.max(
          1,
          Math.trunc(
            options.customerLimit,
          ),
        );

  const result: CustomerTagSyncResult = {
    customersProcessed: 0,
    customersWithTags: 0,
    activeTags: 0,
    tagsCreated: 0,
    tagsUpdated: 0,
    tagsDeactivated: 0,
    failedCustomers: 0,
    windowStartAt,
    windowEndAt: now,
  };

  let cursorId: string | null = null;

  while (
    customerLimit === null ||
    result.customersProcessed <
      customerLimit
  ) {
    const remaining =
      customerLimit === null
        ? PAGE_SIZE
        : Math.min(
            PAGE_SIZE,
            customerLimit -
              result.customersProcessed,
          );

    const customers: Array<{
      id: string;
      bookings: Parameters<
        typeof buildCustomerProfile
      >[0];
      behaviourTags: Array<{
        id: string;
        tagId: string;
      }>;
    }> =
      await prisma.normalCustomer.findMany({
        where: {
          OR: [
            {
              lastBookingAt: {
                gte: windowStartAt,
              },
            },
            {
              behaviourTags: {
                some: {
                  active: true,
                },
              },
            },
          ],
        },
        orderBy: {
          id: "asc",
        },
        take: remaining,
        ...(cursorId
          ? {
              cursor: {
                id: cursorId,
              },
              skip: 1,
            }
          : {}),
        select: {
          id: true,
          bookings: {
            orderBy: [
              {
                pickupDueTime:
                  "desc",
              },
              {
                bookedAtTime:
                  "desc",
              },
            ],
            select:
              bookingSelection,
          },
          behaviourTags: {
            where: {
              active: true,
            },
            select: {
              id: true,
              tagId: true,
            },
          },
        },
      });

    if (customers.length === 0) {
      break;
    }

    cursorId =
      customers[
        customers.length - 1
      ].id;

    for (const customer of customers) {
      try {
        const profile =
          buildCustomerProfile(
            customer.bookings,
            now,
          );
        const activeTagIds =
          profile.tags.map(
            (tag) => tag.id,
          );

        const existingByTagId =
          new Map(
            customer.behaviourTags.map(
              (tag) => [
                tag.tagId,
                tag.id,
              ],
            ),
          );

        const deactivated =
          await prisma.customerBehaviourTag.updateMany({
            where: {
              normalCustomerId:
                customer.id,
              active: true,
              ...(activeTagIds.length >
              0
                ? {
                    tagId: {
                      notIn:
                        activeTagIds,
                    },
                  }
                : {}),
            },
            data: {
              active: false,
            },
          });

        result.tagsDeactivated +=
          deactivated.count;

        for (const tag of profile.tags) {
          const existed =
            existingByTagId.has(
              tag.id,
            );

          await prisma.customerBehaviourTag.upsert({
            where: {
              normalCustomerId_tagId: {
                normalCustomerId:
                  customer.id,
                tagId: tag.id,
              },
            },
            create: {
              normalCustomerId:
                customer.id,
              tagId: tag.id,
              label: tag.label,
              category:
                tag.category,
              confidence:
                tag.confidence,
              evidenceCount:
                tag.evidenceCount,
              eligibleCount:
                tag.eligibleCount,
              percentage:
                tag.percentage,
              windowDays:
                tag.windowDays,
              windowStartAt,
              windowEndAt: now,
              lastObservedAt:
                tag.lastObservedAt
                  ? new Date(
                      tag.lastObservedAt,
                    )
                  : null,
              active: true,
              explanation:
                tag.explanation,
            },
            update: {
              label: tag.label,
              category:
                tag.category,
              confidence:
                tag.confidence,
              evidenceCount:
                tag.evidenceCount,
              eligibleCount:
                tag.eligibleCount,
              percentage:
                tag.percentage,
              windowDays:
                tag.windowDays,
              windowStartAt,
              windowEndAt: now,
              lastObservedAt:
                tag.lastObservedAt
                  ? new Date(
                      tag.lastObservedAt,
                    )
                  : null,
              active: true,
              explanation:
                tag.explanation,
            },
          });

          if (existed) {
            result.tagsUpdated += 1;
          } else {
            result.tagsCreated += 1;
          }
        }

        result.customersProcessed += 1;
        result.activeTags +=
          profile.tags.length;

        if (profile.tags.length > 0) {
          result.customersWithTags += 1;
        }
      } catch (error) {
        result.customersProcessed += 1;
        result.failedCustomers += 1;

        console.error(
          `Customer behaviour tag sync failed for ${customer.id}:`,
          error,
        );
      }
    }

    if (
      customers.length <
      remaining
    ) {
      break;
    }
  }

  return result;
}
