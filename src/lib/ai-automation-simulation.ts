import {
  randomUUID,
} from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const DAY_MS =
  24 * 60 * 60 * 1000;

type CountRow = {
  count: bigint;
};

function numberCount(
  rows: CountRow[],
) {
  return Number(
    rows[0]?.count ?? 0,
  );
}

function londonDateKey(
  value: Date,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Europe/London",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(value);

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ]),
    );

  return [
    values.year,
    values.month,
    values.day,
  ].join("-");
}

function safeError(
  error: unknown,
) {
  return (
    error instanceof Error
      ? error.message
      : "Automation simulation failed."
  )
    .replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[REDACTED_EMAIL]",
    )
    .replace(
      /https?:\/\/[^\s]+/gi,
      "[REDACTED_URL]",
    )
    .replace(
      /\+?[0-9][0-9\s().-]{8,}[0-9]/g,
      "[REDACTED_NUMBER]",
    )
    .slice(0, 2000);
}

async function simulatePredictionMaintenance({
  now,
  batchSize,
}: {
  now: Date;
  batchSize: number;
}) {
  const activeSince =
    new Date(
      now.getTime() -
        60 * DAY_MS,
    );

  const [
    candidates,
    expired,
  ] = await Promise.all([
    prisma.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
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
          ) >= 5
          AND (
            state."normalCustomerId" IS NULL
            OR state.status IN (
              'DIRTY',
              'FAILED'
            )
            OR state."nextRefreshAt" IS NULL
            OR state."nextRefreshAt" <=
              ${now}
          )
      `,
    ),

    prisma.customerBookingPrediction.count({
      where: {
        status: "PENDING",
        windowEndAt: {
          lte: now,
        },
      },
    }),
  ]);

  const candidateCount =
    numberCount(candidates);

  const selectedCandidates =
    Math.min(
      candidateCount,
      batchSize,
    );

  const selectedExpired =
    Math.min(
      expired,
      batchSize,
    );

  return {
    selected:
      selectedCandidates +
      selectedExpired,
    hasMore:
      candidateCount >
        selectedCandidates ||
      expired >
        selectedExpired,
    evidence: {
      operation:
        "CUSTOMER_BOOKING_PREDICTIONS",
      candidateProfiles:
        candidateCount,
      expiredPredictions:
        expired,
      wouldRefresh:
        selectedCandidates,
      wouldEvaluate:
        selectedExpired,
      activeDays: 60,
      minimumBookings: 5,
      batchSize,
      externalActions: false,
      customerContact: false,
      containsPersonalData: false,
    },
  };
}

async function simulateProfileSnapshots({
  now,
  batchSize,
}: {
  now: Date;
  batchSize: number;
}) {
  const activeSince =
    new Date(
      now.getTime() -
        60 * DAY_MS,
    );

  const snapshotDate =
    new Date(
      `${londonDateKey(
        now,
      )}T00:00:00.000Z`,
    );

  const rows =
    await prisma.$queryRaw<
      CountRow[]
    >(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "NormalCustomer" customer
        WHERE
          customer."lastBookingAt" >=
            ${activeSince}
          AND (
            SELECT COUNT(*)
            FROM "Booking" booking
            WHERE booking."normalCustomerId" =
              customer.id
          ) >= 5
          AND NOT EXISTS (
            SELECT 1
            FROM "CustomerProfileSnapshot" snapshot
            WHERE
              snapshot."normalCustomerId" =
                customer.id
              AND snapshot."snapshotDate" =
                ${snapshotDate}
          )
      `,
    );

  const eligible =
    numberCount(rows);
  const selected =
    Math.min(
      eligible,
      batchSize,
    );

  return {
    selected,
    hasMore:
      eligible > selected,
    evidence: {
      operation:
        "CUSTOMER_PROFILE_SNAPSHOTS",
      snapshotDate:
        londonDateKey(now),
      eligibleProfiles:
        eligible,
      wouldSnapshot:
        selected,
      activeDays: 60,
      minimumBookings: 5,
      batchSize,
      externalActions: false,
      customerContact: false,
      containsPersonalData: false,
    },
  };
}

async function simulateDemandForecast({
  now,
}: {
  now: Date;
}) {
  const [
    expired,
    active,
    openAlerts,
  ] = await Promise.all([
    prisma.bookingDemandForecast.count({
      where: {
        modelVersion:
          "BOOKING_DEMAND_V1",
        targetType:
          "BOOKING_REQUESTS",
        status: "PENDING",
        windowEndAt: {
          lte: now,
        },
      },
    }),

    prisma.bookingDemandForecast.count({
      where: {
        modelVersion:
          "BOOKING_DEMAND_V1",
        targetType:
          "BOOKING_REQUESTS",
        status: "PENDING",
        windowEndAt: {
          gt: now,
        },
      },
    }),

    prisma.bookingDemandAlert.count({
      where: {
        status: "OPEN",
      },
    }),
  ]);

  return {
    selected:
      expired + 1,
    hasMore: false,
    evidence: {
      operation:
        "BOOKING_DEMAND_FORECAST",
      expiredForecasts:
        expired,
      activeForecasts:
        active,
      wouldEvaluate:
        expired,
      wouldMaintainForecast: true,
      wouldEvaluateAlerts: true,
      currentOpenAlerts:
        openAlerts,
      externalActions: false,
      customerContact: false,
      containsPersonalData: false,
    },
  };
}

async function simulateHistoricalGeoapify({
  now,
  batchSize,
}: {
  now: Date;
  batchSize: number;
}) {
  const waitingRows =
    await prisma.$queryRaw<
      CountRow[]
    >(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "BookingLocation" location
        JOIN "Booking" booking
          ON booking.id =
            location."bookingId"
        LEFT JOIN "PlaceIntelligence" place
          ON place.id =
            location."placeIntelligenceId"
        WHERE
          location.latitude IS NOT NULL
          AND location.longitude IS NOT NULL
          AND COALESCE(
            booking."pickupDueTime",
            booking."bookedAtTime"
          ) <= ${now}
          AND (
            location."placeIntelligenceId"
              IS NULL
            OR (
              place.status IN (
                'PENDING',
                'FAILED'
              )
              AND (
                place."nextRetryAt" IS NULL
                OR place."nextRetryAt" <=
                  ${now}
              )
            )
          )
      `,
    );

  const configuration =
    await prisma.geoapifyApiConfiguration.findUnique({
      where: {
        provider: "GEOAPIFY",
      },
      select: {
        isEnabled: true,
        dailyLimit: true,
        dailyUsed: true,
        usageDate: true,
      },
    });

  const waiting =
    numberCount(waitingRows);

  const usageIsToday =
    configuration?.usageDate
      ? londonDateKey(
          configuration.usageDate,
        ) === londonDateKey(now)
      : false;

  const dailyUsed =
    usageIsToday
      ? configuration?.dailyUsed ?? 0
      : 0;

  const dailyLimit =
    configuration?.dailyLimit ?? 0;

  const creditsRemaining =
    Math.max(
      0,
      dailyLimit -
        dailyUsed,
    );

  const selected =
    Math.min(
      waiting,
      batchSize,
      creditsRemaining,
    );

  return {
    selected,
    hasMore:
      waiting > selected,
    evidence: {
      operation:
        "HISTORICAL_GEOAPIFY_BACKFILL",
      integrationEnabled:
        configuration?.isEnabled ??
        false,
      waitingLocations:
        waiting,
      wouldEnrich:
        selected,
      dailyUsed,
      dailyLimit,
      creditsRemaining,
      batchSize,
      externalActions: true,
      providerCallSimulated: true,
      providerCreditsConsumed: 0,
      customerContact: false,
      containsPersonalData: false,
    },
  };
}

export async function simulateAutomationRule({
  ruleId,
  actorUserId,
  now = new Date(),
}: {
  ruleId: string;
  actorUserId: string;
  now?: Date;
}) {
  const rule =
    await prisma.automationRule.findUnique({
      where: {
        id: ruleId,
      },
    });

  if (!rule) {
    throw new Error(
      "Automation rule was not found.",
    );
  }

  const startedAt =
    new Date();

  const simulation =
    rule.key ===
    "BOOKING_PREDICTION_MAINTENANCE"
      ? await simulatePredictionMaintenance({
          now,
          batchSize:
            rule.defaultBatchSize,
        })
      : rule.key ===
          "CUSTOMER_PROFILE_SNAPSHOTS"
        ? await simulateProfileSnapshots({
            now,
            batchSize:
              rule.defaultBatchSize,
          })
        : rule.key ===
            "BOOKING_DEMAND_FORECAST"
          ? await simulateDemandForecast({
              now,
            })
          : rule.key ===
              "HISTORICAL_GEOAPIFY_BACKFILL"
            ? await simulateHistoricalGeoapify({
                now,
                batchSize:
                  rule.defaultBatchSize,
              })
            : null;

  if (!simulation) {
    throw new Error(
      "Automation rule does not have a supported simulation.",
    );
  }

  const finishedAt =
    new Date();

  const executionKey = [
    "SIMULATION",
    rule.id,
    now.toISOString(),
    randomUUID(),
  ].join(":");

  const evidence =
    simulation.evidence as Prisma.InputJsonValue;

  const execution =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.automationExecution.create({
            data: {
              executionKey,
              ruleId: rule.id,
              mode: "SIMULATION",
              status: "SUCCEEDED",
              source: "MANUAL",
              requestedByUserId:
                actorUserId,
              startedAt,
              finishedAt,
              durationMs:
                finishedAt.getTime() -
                startedAt.getTime(),
              selected:
                simulation.selected,
              processed: 0,
              succeeded: 0,
              failed: 0,
              hasMore:
                simulation.hasMore,
              evidence,
            },
          });

        await tx.automationRule.update({
          where: {
            id: rule.id,
          },
          data: {
            lastSimulatedAt:
              finishedAt,
          },
        });

        await tx.administrationAuditEvent.create({
          data: {
            actorUserId,
            action:
              "AUTOMATION_RULE_SIMULATED",
            targetType:
              "AUTOMATION_RULE",
            targetId:
              rule.id,
            evidence: {
              containsPersonalData:
                false,
              ruleKey:
                rule.key,
              selected:
                simulation.selected,
              hasMore:
                simulation.hasMore,
              externalActionsExecuted:
                false,
              customerContact:
                false,
            },
          },
        });

        return created;
      },
    );

  return {
    success: true,
    rule: {
      id: rule.id,
      key: rule.key,
      name: rule.name,
      status: rule.status,
      configuredMode:
        rule.mode,
    },
    simulation: {
      executionId:
        execution.id,
      status:
        execution.status,
      selected:
        execution.selected,
      hasMore:
        execution.hasMore,
      startedAt:
        execution.startedAt,
      finishedAt:
        execution.finishedAt,
      durationMs:
        execution.durationMs,
      evidence:
        execution.evidence,
    },
    externalActionsExecuted: false,
    containsPersonalData: false,
  };
}

export function automationSimulationError(
  error: unknown,
) {
  return safeError(error);
}
