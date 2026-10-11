import { prisma } from "@/lib/prisma";
import { buildCustomerBehaviourTags } from "@/lib/customers/customer-behaviour-tags";

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
  nextCursor: string | null;
  hasMore: boolean;
  dryRun: boolean;
  failedCustomerIds: string[];
};

const bookingSelection = {
  status: true,
  bookedAtTime: true,
  pickupDueTime: true,
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
    scope?: "recent" | "all";
    afterId?: string;
    dryRun?: boolean;
  } = {},
): Promise<CustomerTagSyncResult> {
  const now =
    options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid tag calculation date");
  if (options.customerLimit !== undefined && (!Number.isInteger(options.customerLimit) || options.customerLimit < 1 || options.customerLimit > 200)) throw new Error("Customer batch limit must be an integer from 1 to 200");
  const windowStartAt =
    new Date(
      now.getTime() -
        WINDOW_DAYS * DAY_MS,
    );
  const customerLimit =
    options.customerLimit === undefined
      ? options.scope === "all" ? 50 : null
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
    nextCursor: options.afterId ?? null,
    hasMore: false,
    dryRun: options.dryRun === true,
    failedCustomerIds: [],
  };

  let cursorId: string | null = options.afterId ?? null;

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
        typeof buildCustomerBehaviourTags
      >[0];
      behaviourTags: Array<{
        id: string;
        tagId: string;
      }>;
    }> =
      await prisma.normalCustomer.findMany({
        where: {
          ...(cursorId ? { id: { gt: cursorId } } : {}),
          ...(options.scope === "all" ? {} : { OR: [
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
          ] }),
        },
        orderBy: {
          id: "asc",
        },
        take: remaining,
        select: {
          id: true,
          bookings: {
            where: { OR: [
              { pickupDueTime: { gte: windowStartAt, lte: now } },
              { pickupDueTime: null, bookedAtTime: { gte: windowStartAt, lte: now } },
            ] },
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
        const tags =
          buildCustomerBehaviourTags(
            customer.bookings,
            now,
          );
        const activeTagIds =
          tags.map(
            (tag) => tag.id,
          );

        if (result.dryRun) {
          result.customersProcessed += 1;
          result.activeTags += tags.length;
          if (tags.length) result.customersWithTags += 1;
          continue;
        }

        const existingByTagId =
          new Map(
            customer.behaviourTags.map(
              (tag) => [
                tag.tagId,
                tag.id,
              ],
            ),
          );

        const changes = await prisma.$transaction(async (tx) => {
          let created = 0;
          let updated = 0;
          const deactivated =
            await tx.customerBehaviourTag.updateMany({
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


          for (const tag of tags) {
            const existed =
              existingByTagId.has(
                tag.id,
              );

            await tx.customerBehaviourTag.upsert({
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
              updated += 1;
            } else {
              created += 1;
            }
          }

          return { created, updated, deactivated: deactivated.count };
        });
        result.tagsCreated += changes.created;
        result.tagsUpdated += changes.updated;
        result.tagsDeactivated += changes.deactivated;
        result.customersProcessed += 1;
        result.activeTags +=
          tags.length;

        if (tags.length > 0) {
          result.customersWithTags += 1;
        }
      } catch (error) {
        result.customersProcessed += 1;
        result.failedCustomers += 1;
        result.failedCustomerIds.push(customer.id);

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

  result.nextCursor = cursorId;
  result.hasMore = Boolean(cursorId && await prisma.normalCustomer.findFirst({
    where: { id: { gt: cursorId! }, ...(options.scope === "all" ? {} : { OR: [
      { lastBookingAt: { gte: windowStartAt } }, { behaviourTags: { some: { active: true } } },
    ] }) }, select: { id: true },
  }));
  return result;
}
