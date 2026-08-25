import { createHash } from "node:crypto";

import { buildCustomerBookingWindow } from "@/lib/customers/customer-booking-window";
import { buildCustomerProfile } from "@/lib/customers/customer-profiler";
import { prisma } from "@/lib/prisma";

const MODEL_VERSION = "HAZARD_SLOT_V1";
const PRIMARY_HORIZON_HOURS = 24;

function fingerprint(
  customerId: string,
  bookingActions: Array<{
    externalId: string;
    bookedAtTime: Date | null;
  }>,
  score: number,
  windowStartAt: string,
  windowEndAt: string,
  likelyStartAt: string | null,
  likelyEndAt: string | null,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        customerId,
        model: MODEL_VERSION,
        horizonHours:
          PRIMARY_HORIZON_HOURS,
        actions: bookingActions.map(
          (booking) => [
            booking.externalId,
            booking.bookedAtTime
              ?.toISOString() ?? null,
          ],
        ),
        score,
        windowStartAt,
        windowEndAt,
        likelyStartAt,
        likelyEndAt,
      }),
    )
    .digest("hex");
}

async function resolvePredictionOutcomes(
  customerId: string,
  now: Date,
  triggerBookingId?: string,
) {
  if (triggerBookingId) {
    const triggerBooking =
      await prisma.booking.findFirst({
        where: {
          id: triggerBookingId,
          normalCustomerId: customerId,
          bookedAtTime: {
            not: null,
          },
        },
        select: {
          id: true,
          bookedAtTime: true,
        },
      });

    if (triggerBooking?.bookedAtTime) {
      const matchingPredictions =
        await prisma.customerBookingPrediction.findMany({
          where: {
            normalCustomerId: customerId,
            status: "PENDING",
            issuedAt: {
              lt: triggerBooking.bookedAtTime,
            },
            windowStartAt: {
              lte: triggerBooking.bookedAtTime,
            },
            windowEndAt: {
              gte: triggerBooking.bookedAtTime,
            },
          },
          select: {
            id: true,
          },
        });

      if (matchingPredictions.length > 0) {
        await prisma.customerBookingPrediction.updateMany({
          where: {
            id: {
              in: matchingPredictions.map(
                (prediction) =>
                  prediction.id,
              ),
            },
            status: "PENDING",
          },
          data: {
            status: "HIT",
            matchedBookingId:
              triggerBooking.id,
            evaluatedAt: now,
            activeKey: null,
          },
        });
      }
    }
  }

  await prisma.customerBookingPrediction.updateMany({
    where: {
      normalCustomerId: customerId,
      status: "PENDING",
      windowEndAt: {
        lt: now,
      },
    },
    data: {
      status: "MISSED",
      evaluatedAt: now,
      activeKey: null,
    },
  });
}

export async function refreshCustomerBookingPrediction(
  customerId: string,
  {
    now = new Date(),
    triggerBookingId,
  }: {
    now?: Date;
    triggerBookingId?: string;
  } = {},
) {
  await prisma.customerIntelligenceState.upsert({
    where: {
      normalCustomerId: customerId,
    },
    create: {
      normalCustomerId: customerId,
      status: "DIRTY",
      dirtyAt: now,
    },
    update: {
      status: "DIRTY",
      dirtyAt: now,
      lastError: null,
    },
  });

  try {
    await resolvePredictionOutcomes(
      customerId,
      now,
      triggerBookingId,
    );

    const customer =
      await prisma.normalCustomer.findUnique({
        where: {
          id: customerId,
        },
        select: {
          id: true,
          bookings: {
            orderBy: {
              bookedAtTime: "asc",
            },
            select: {
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
                },
              },
            },
          },
        },
      });

    if (!customer) {
      throw new Error(
        "Normal customer was not found.",
      );
    }

    const profile =
      buildCustomerProfile(
        customer.bookings,
        now,
      );

    const bookingWindow =
      buildCustomerBookingWindow(
        customer.bookings,
        {
          now,
          profileSafeForPersonalisation:
            profile.classification
              .profileSafeForPersonalisation,
        },
      );

    if (bookingWindow.status !== "READY") {
      await prisma.customerIntelligenceState.update({
        where: {
          normalCustomerId: customerId,
        },
        data: {
          status: "CURRENT",
          inputFingerprint: null,
          lastCalculatedAt: now,
          nextRefreshAt: new Date(
            now.getTime() +
              24 * 60 * 60 * 1000,
          ),
          lastError: null,
          attemptCount: 0,
        },
      });

      return {
        status: bookingWindow.status,
        prediction: null,
      };
    }

    const primary =
      bookingWindow.horizons.find(
        (horizon) =>
          horizon.horizonHours ===
          PRIMARY_HORIZON_HOURS,
      );

    if (!primary) {
      throw new Error(
        "Primary 24-hour booking horizon was not generated.",
      );
    }

    const likelyStartAt =
      primary.strongestSlot.startAt;
    const likelyEndAt =
      primary.strongestSlot.endAt;

    const inputFingerprint =
      fingerprint(
        customer.id,
        customer.bookings,
        primary.score,
        primary.windowStartAt,
        primary.windowEndAt,
        likelyStartAt,
        likelyEndAt,
      );

    const activeKey = [
      customerId,
      MODEL_VERSION,
      PRIMARY_HORIZON_HOURS,
    ].join(":");

    const existingActive =
      await prisma.customerBookingPrediction.findUnique({
        where: {
          activeKey,
        },
      });

    const prediction =
      existingActive ??
      await prisma.customerBookingPrediction.upsert({
        where: {
          activeKey,
        },
        create: {
          normalCustomerId: customerId,
          modelVersion:
            MODEL_VERSION,
          horizonHours:
            PRIMARY_HORIZON_HOURS,
          issuedAt: now,
          windowStartAt:
            new Date(primary.windowStartAt),
          windowEndAt:
            new Date(primary.windowEndAt),
          likelyWindowStartAt:
            likelyStartAt
              ? new Date(likelyStartAt)
              : null,
          likelyWindowEndAt:
            likelyEndAt
              ? new Date(likelyEndAt)
              : null,
          score: primary.score,
          level: primary.level,
          observedRate:
            primary.observedBenchmarkRate,
          evidenceConfidence:
            primary.evidenceConfidence,
          calibrationSamples:
            primary.calibrationSamples,
          status: "PENDING",
          inputFingerprint,
          activeKey,
        },
        update: {},
      });

    await prisma.customerIntelligenceState.update({
      where: {
        normalCustomerId: customerId,
      },
      data: {
        status: "CURRENT",
        inputFingerprint,
        lastCalculatedAt: now,
        nextRefreshAt:
          prediction.windowEndAt,
        lastError: null,
        attemptCount: 0,
      },
    });

    return {
      status: "READY" as const,
      created:
        existingActive === null,
      prediction,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Customer prediction refresh failed.";

    await prisma.customerIntelligenceState.update({
      where: {
        normalCustomerId: customerId,
      },
      data: {
        status: "FAILED",
        lastError:
          message.slice(0, 5000),
        attemptCount: {
          increment: 1,
        },
      },
    });

    throw error;
  }
}

export async function evaluateExpiredBookingPredictions(
  {
    now = new Date(),
    limit = 100,
  }: {
    now?: Date;
    limit?: number;
  } = {},
) {
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    500,
  );

  const expired =
    await prisma.customerBookingPrediction.findMany({
      where: {
        status: "PENDING",
        windowEndAt: {
          lt: now,
        },
      },
      orderBy: {
        windowEndAt: "asc",
      },
      take: safeLimit,
      select: {
        id: true,
        normalCustomerId: true,
      },
    });

  if (expired.length === 0) {
    return {
      evaluated: 0,
      missed: 0,
      hasMore: false,
    };
  }

  const result =
    await prisma.customerBookingPrediction.updateMany({
      where: {
        id: {
          in: expired.map(
            (prediction) =>
              prediction.id,
          ),
        },
        status: "PENDING",
      },
      data: {
        status: "MISSED",
        evaluatedAt: now,
        activeKey: null,
      },
    });

  await prisma.customerIntelligenceState.updateMany({
    where: {
      normalCustomerId: {
        in: Array.from(
          new Set(
            expired.map(
              (prediction) =>
                prediction.normalCustomerId,
            ),
          ),
        ),
      },
    },
    data: {
      status: "DIRTY",
      dirtyAt: now,
      nextRefreshAt: null,
    },
  });

  return {
    evaluated: expired.length,
    missed: result.count,
    hasMore:
      expired.length === safeLimit,
  };
}

export async function getCustomerPredictionHistory(
  customerId: string,
  limit = 30,
) {
  const predictions =
    await prisma.customerBookingPrediction.findMany({
      where: {
        normalCustomerId: customerId,
        modelVersion:
          MODEL_VERSION,
        horizonHours:
          PRIMARY_HORIZON_HOURS,
      },
      orderBy: {
        issuedAt: "desc",
      },
      take: Math.min(
        Math.max(Math.trunc(limit), 1),
        100,
      ),
      select: {
        id: true,
        modelVersion: true,
        issuedAt: true,
        windowStartAt: true,
        windowEndAt: true,
        likelyWindowStartAt: true,
        likelyWindowEndAt: true,
        score: true,
        level: true,
        observedRate: true,
        evidenceConfidence: true,
        calibrationSamples: true,
        status: true,
        evaluatedAt: true,
      },
    });

  const resolved = predictions.filter(
    (prediction) =>
      prediction.status === "HIT" ||
      prediction.status === "MISSED",
  );

  const hits = resolved.filter(
    (prediction) =>
      prediction.status === "HIT",
  ).length;

  return {
    predictions: predictions.map(
      (prediction) => ({
        ...prediction,
        score: Number(
          prediction.score,
        ),
        observedRate: Number(
          prediction.observedRate,
        ),
      }),
    ),
    accuracy: {
      evaluated: resolved.length,
      hits,
      missed:
        resolved.length - hits,
      hitRate:
        resolved.length > 0
          ? Number(
              (
                100 *
                hits /
                resolved.length
              ).toFixed(1),
            )
          : null,
    },
  };
}


export async function runCustomerPredictionMaintenance(
  {
    now = new Date(),
    limit = 50,
    activeDays = 60,
    minimumBookings = 5,
  }: {
    now?: Date;
    limit?: number;
    activeDays?: number;
    minimumBookings?: number;
  } = {},
) {
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    100,
  );

  const safeActiveDays = Math.min(
    Math.max(Math.trunc(activeDays), 1),
    365,
  );

  const safeMinimumBookings = Math.min(
    Math.max(
      Math.trunc(minimumBookings),
      5,
    ),
    100,
  );

  const expired =
    await evaluateExpiredBookingPredictions({
      now,
      limit: safeLimit,
    });

  const activeSince = new Date(
    now.getTime() -
      safeActiveDays *
        24 *
        60 *
        60 *
        1000,
  );

  const candidates =
    await prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >`
      SELECT customer.id
      FROM "NormalCustomer" customer
      LEFT JOIN "CustomerIntelligenceState" state
        ON state."normalCustomerId" =
          customer.id
      WHERE
        customer."lastBookingAt" >=
          ${activeSince}
        AND (
          SELECT COUNT(*)
          FROM "Booking" booking
          WHERE booking."normalCustomerId" =
            customer.id
            AND booking."bookedAtTime"
              IS NOT NULL
        ) >= ${safeMinimumBookings}
        AND (
          state."normalCustomerId" IS NULL
          OR state.status IN (
            'DIRTY',
            'FAILED'
          )
          OR state."nextRefreshAt" IS NULL
          OR state."nextRefreshAt" <= ${now}
        )
      ORDER BY
        CASE
          WHEN state.status = 'DIRTY'
            THEN 0
          WHEN state.status = 'FAILED'
            THEN 1
          WHEN state."normalCustomerId"
            IS NULL
            THEN 2
          ELSE 3
        END,
        state."dirtyAt" ASC NULLS FIRST,
        customer."lastBookingAt" DESC,
        customer.id ASC
      LIMIT ${safeLimit}
    `;

  let refreshed = 0;
  let ready = 0;
  let learning = 0;
  let disabled = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const result =
        await refreshCustomerBookingPrediction(
          candidate.id,
          {
            now,
          },
        );

      refreshed += 1;

      if (result.status === "READY") {
        ready += 1;
      } else if (
        result.status === "LEARNING"
      ) {
        learning += 1;
      } else {
        disabled += 1;
      }
    } catch (error) {
      failed += 1;

      console.error(
        "Customer prediction maintenance failed:",
        error,
      );
    }
  }

  return {
    success: failed === 0,
    evaluatedExpired:
      expired.evaluated,
    markedMissed:
      expired.missed,
    selected: candidates.length,
    refreshed,
    ready,
    learning,
    disabled,
    failed,
    hasMore:
      expired.hasMore ||
      candidates.length === safeLimit,
  };
}
