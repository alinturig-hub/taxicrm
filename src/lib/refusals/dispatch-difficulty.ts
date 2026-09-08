import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getEffectiveDriverRejectionReportByPickupPeriod,
} from "@/lib/refusals/effective-driver-rejections";

type EventAggregateRow = {
  bookingId: string;
  rawDispatchAttempts: bigint;
  rawRejectionAttempts: bigint;
  firstDispatchAt: Date | null;
  firstRejectedAt: Date | null;
  lastRejectedAt: Date | null;
  acceptedAt: Date | null;
};

type AffectedBookingRow = {
  bookingId: string;
};

type ControlBucketRow = {
  jobs: bigint;
  cancelledJobs: bigint;
  acceptedJobs: bigint;
  averageSecondsToAcceptance:
    unknown;
};

export type DispatchDifficultyJob = {
  bookingId: string;
  rawDispatchAttempts: number;
  rawRejectionAttempts: number;
  uniqueRejectingDrivers: number;
  effectiveDriverRejections: number;
  recoveredDriverRejections: number;
  firstDispatchAt: string | null;
  firstRejectedAt: string | null;
  lastRejectedAt: string | null;
  acceptedAt: string | null;
  secondsFromFirstDispatchToAcceptance:
    number | null;
  finalOutcome: string;
  completedAt: string | null;
  cancelledAt: string | null;
  noFareAt: string | null;
  secondsFromLastRejectionToCancellation:
    number | null;
  pickupDueTime: string | null;
  minutesFromFirstDispatchToPickup:
    number | null;
  typeOfBooking: string | null;
  bookingSource: string | null;
  pickupZone: string | null;
  estimatedValue: number;
};

export type DispatchDifficultyBucket = {
  bucket:
    | "0"
    | "1"
    | "2"
    | "3"
    | "4+";
  jobs: number;
  cancelledJobs: number;
  cancellationRate: number;
  acceptedJobs: number;
  averageSecondsToAcceptance:
    number | null;
};

function secondsBetween(
  from: Date | null,
  to: Date | null,
) {
  if (!from || !to) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      (
        to.getTime() -
        from.getTime()
      ) /
        1000,
    ),
  );
}

function minutesBetween(
  from: Date | null,
  to: Date | null,
) {
  const seconds =
    secondsBetween(
      from,
      to,
    );

  return seconds === null
    ? null
    : Number(
        (
          seconds /
          60
        ).toFixed(1),
      );
}

function percentage(
  value: number,
  total: number,
) {
  return total > 0
    ? Number(
        (
          (
            value /
            total
          ) *
          100
        ).toFixed(2),
      )
    : 0;
}

function finalOutcome(
  booking: {
    status: string;
    completedAt: Date | null;
    cancelledAt: Date | null;
    noFareAt: Date | null;
    acceptedAt: Date | null;
  },
) {
  if (booking.completedAt) {
    return "COMPLETED";
  }

  if (booking.cancelledAt) {
    return "CANCELLED";
  }

  if (booking.noFareAt) {
    return "NO_FARE";
  }

  if (booking.acceptedAt) {
    return "ACCEPTED";
  }

  return (
    booking.status
      .trim()
      .toUpperCase() ||
    "ACTIVE"
  );
}

export async function getDispatchDifficultyReport(
  from: string,
  to: string,
) {
  const [
    rejectionReport,
    affectedBookingRows,
    controlRows,
  ] = await Promise.all([
    getEffectiveDriverRejectionReportByPickupPeriod(
      from,
      to,
    ),

    prisma.$queryRaw<
      AffectedBookingRow[]
    >(
      Prisma.sql`
        SELECT DISTINCT
          booking."externalId"
            AS "bookingId"
        FROM "Booking" booking
        WHERE
          booking.provider =
            'AUTOCAB'
          AND (
            booking."pickupDueTime"
              AT TIME ZONE
                'Europe/London'
          )::date >=
            CAST(${from} AS date)
          AND (
            booking."pickupDueTime"
              AT TIME ZONE
                'Europe/London'
          )::date <=
            CAST(${to} AS date)
          AND EXISTS (
            SELECT 1
            FROM "WebhookEvent" rejected
            WHERE
              rejected."externalBookingId" =
                booking."externalId"
              AND rejected."eventType" =
                'BookingRejected'
              AND rejected.status =
                'PROCESSED'
          )
      `,
    ),

    prisma.$queryRaw<
      ControlBucketRow[]
    >(
      Prisma.sql`
        WITH zero_rejection_bookings
          AS MATERIALIZED (
          SELECT
            booking."externalId"
              AS booking_id,
            booking."acceptedAt"
              AS booking_accepted_at,
            booking."completedAt"
              AS completed_at,
            booking."cancelledAt"
              AS cancelled_at
          FROM "Booking" booking
          WHERE
            booking.provider =
              'AUTOCAB'
            AND (
              booking."pickupDueTime"
                AT TIME ZONE
                  'Europe/London'
            )::date >=
              CAST(${from} AS date)
            AND (
              booking."pickupDueTime"
                AT TIME ZONE
                  'Europe/London'
            )::date <=
              CAST(${to} AS date)
            AND NOT EXISTS (
              SELECT 1
              FROM "WebhookEvent" rejected
              WHERE
                rejected."externalBookingId" =
                  booking."externalId"
                AND rejected."eventType" =
                  'BookingRejected'
                AND rejected.status =
                  'PROCESSED'
            )
        ),
        event_times AS (
          SELECT
            zero.booking_id,
            zero.booking_accepted_at,
            zero.completed_at,
            zero.cancelled_at,
            MIN(event."receivedAt") FILTER (
              WHERE event."eventType" =
                'BookingDispatched'
            ) AS first_dispatch_at,
            MIN(event."receivedAt") FILTER (
              WHERE event."eventType" =
                'BookingDispatchAccepted'
            ) AS accepted_event_at
          FROM zero_rejection_bookings zero
          LEFT JOIN "WebhookEvent" event
            ON event."externalBookingId" =
              zero.booking_id
            AND event.status =
              'PROCESSED'
            AND event."eventType" IN (
              'BookingDispatched',
              'BookingDispatchAccepted'
            )
          GROUP BY
            zero.booking_id,
            zero.booking_accepted_at,
            zero.completed_at,
            zero.cancelled_at
        ),
        measured AS (
          SELECT
            event_times.*,
            COALESCE(
              accepted_event_at,
              booking_accepted_at
            ) AS actual_accepted_at
          FROM event_times
        )
        SELECT
          COUNT(*)::bigint
            AS jobs,
          COUNT(*) FILTER (
            WHERE completed_at IS NULL
              AND cancelled_at IS NOT NULL
          )::bigint
            AS "cancelledJobs",
          COUNT(*) FILTER (
            WHERE actual_accepted_at
              IS NOT NULL
          )::bigint
            AS "acceptedJobs",
          AVG(
            EXTRACT(
              EPOCH FROM (
                actual_accepted_at -
                first_dispatch_at
              )
            )
          ) FILTER (
            WHERE actual_accepted_at
              IS NOT NULL
              AND first_dispatch_at
                IS NOT NULL
              AND actual_accepted_at >=
                first_dispatch_at
          ) AS
            "averageSecondsToAcceptance"
        FROM measured
      `,
    ),
  ]);

  const classified =
    rejectionReport.classifiedDetails;

  const bookingIds =
    affectedBookingRows.map(
      (row) =>
        row.bookingId,
    );

  const controlRow =
    controlRows[0];

  const controlJobs =
    Number(
      controlRow?.jobs ??
      0,
    );

  const controlCancelledJobs =
    Number(
      controlRow?.cancelledJobs ??
      0,
    );

  const controlAverage =
    controlRow
      ?.averageSecondsToAcceptance;

  const controlBucket:
    DispatchDifficultyBucket = {
      bucket: "0",
      jobs:
        controlJobs,
      cancelledJobs:
        controlCancelledJobs,
      cancellationRate:
        percentage(
          controlCancelledJobs,
          controlJobs,
        ),
      acceptedJobs:
        Number(
          controlRow?.acceptedJobs ??
          0,
        ),
      averageSecondsToAcceptance:
        controlAverage ===
          null ||
        controlAverage ===
          undefined
          ? null
          : Math.round(
              Number(
                controlAverage,
              ),
            ),
    };

  if (bookingIds.length === 0) {
    return {
      summary: {
        ...rejectionReport.summary,
        cohortJobs:
          controlJobs,
        noRejectionJobs:
          controlJobs,
        recoveredOnlyJobs: 0,
        affectedJobs: 0,
        acceptedAfterRejection: 0,
        completedAfterRejection: 0,
        cancelledAfterRejection: 0,
        noFareAfterRejection: 0,
        cancellationRateAfterRejection: 0,
        averageSecondsToAcceptance: null,
      },
      buckets: [
        controlBucket,
      ],
      jobs: [] as DispatchDifficultyJob[],
    };
  }

  const [
    bookings,
    eventRows,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        provider:
          "AUTOCAB",
        externalId: {
          in: bookingIds,
        },
      },
      select: {
        externalId: true,
        status: true,
        acceptedAt: true,
        completedAt: true,
        cancelledAt: true,
        noFareAt: true,
        pickupDueTime: true,
        typeOfBooking: true,
        bookingSource: true,
        price: true,
        estimatedPrice: true,
        locations: {
          where: {
            type: "PICKUP",
          },
          select: {
            zoneName: true,
          },
          take: 1,
        },
      },
    }),

    prisma.$queryRaw<
      EventAggregateRow[]
    >(
      Prisma.sql`
        SELECT
          event."externalBookingId"
            AS "bookingId",
          COUNT(*) FILTER (
            WHERE event."eventType" =
              'BookingDispatched'
          )::bigint AS "rawDispatchAttempts",
          COUNT(*) FILTER (
            WHERE event."eventType" =
              'BookingRejected'
          )::bigint AS "rawRejectionAttempts",
          MIN(event."receivedAt") FILTER (
            WHERE event."eventType" =
              'BookingDispatched'
          ) AS "firstDispatchAt",
          MIN(event."receivedAt") FILTER (
            WHERE event."eventType" =
              'BookingRejected'
          ) AS "firstRejectedAt",
          MAX(event."receivedAt") FILTER (
            WHERE event."eventType" =
              'BookingRejected'
          ) AS "lastRejectedAt",
          MIN(event."receivedAt") FILTER (
            WHERE event."eventType" =
              'BookingDispatchAccepted'
          ) AS "acceptedAt"
        FROM "WebhookEvent" event
        WHERE
          event.status =
            'PROCESSED'
          AND event."externalBookingId"
            IN (
              ${Prisma.join(
                bookingIds,
              )}
            )
          AND event."eventType" IN (
            'BookingDispatched',
            'BookingRejected',
            'BookingDispatchAccepted'
          )
        GROUP BY
          event."externalBookingId"
      `,
    ),
  ]);

  const bookingByExternalId =
    new Map(
      bookings.map(
        (booking) => [
          booking.externalId,
          booking,
        ],
      ),
    );

  const eventByBookingId =
    new Map(
      eventRows.map(
        (event) => [
          event.bookingId,
          event,
        ],
      ),
    );

  const classificationByBooking =
    new Map<
      string,
      typeof classified
    >();

  for (
    const rejection
    of classified
  ) {
    const existing =
      classificationByBooking.get(
        rejection.bookingId,
      ) ?? [];

    existing.push(
      rejection,
    );

    classificationByBooking.set(
      rejection.bookingId,
      existing,
    );
  }

  const jobs:
    DispatchDifficultyJob[] = [];

  for (
    const bookingId
    of bookingIds
  ) {
    const booking =
      bookingByExternalId.get(
        bookingId,
      );

    const events =
      eventByBookingId.get(
        bookingId,
      );

    if (!booking || !events) {
      continue;
    }

    const rejectionPairs =
      classificationByBooking.get(
        bookingId,
      ) ?? [];

    const effective =
      rejectionPairs.filter(
        (rejection) =>
          !rejection.recovered,
      ).length;

    const recovered =
      rejectionPairs.length -
      effective;

    const firstDispatchAt =
      events.firstDispatchAt;

    const acceptedAt =
      events.acceptedAt ??
      booking.acceptedAt;

    const lastRejectedAt =
      events.lastRejectedAt;

    const estimatedValue =
      Number(
        booking.price ??
        booking.estimatedPrice ??
        0,
      );

    jobs.push({
      bookingId,
      rawDispatchAttempts:
        Number(
          events.rawDispatchAttempts,
        ),
      rawRejectionAttempts:
        Number(
          events.rawRejectionAttempts,
        ),
      uniqueRejectingDrivers:
        rejectionPairs.length,
      effectiveDriverRejections:
        effective,
      recoveredDriverRejections:
        recovered,
      firstDispatchAt:
        firstDispatchAt
          ?.toISOString() ??
        null,
      firstRejectedAt:
        events.firstRejectedAt
          ?.toISOString() ??
        null,
      lastRejectedAt:
        lastRejectedAt
          ?.toISOString() ??
        null,
      acceptedAt:
        acceptedAt
          ?.toISOString() ??
        null,
      secondsFromFirstDispatchToAcceptance:
        secondsBetween(
          firstDispatchAt,
          acceptedAt,
        ),
      finalOutcome:
        finalOutcome(
          booking,
        ),
      completedAt:
        booking.completedAt
          ?.toISOString() ??
        null,
      cancelledAt:
        booking.cancelledAt
          ?.toISOString() ??
        null,
      noFareAt:
        booking.noFareAt
          ?.toISOString() ??
        null,
      secondsFromLastRejectionToCancellation:
        secondsBetween(
          lastRejectedAt,
          booking.cancelledAt,
        ),
      pickupDueTime:
        booking.pickupDueTime
          ?.toISOString() ??
        null,
      minutesFromFirstDispatchToPickup:
        minutesBetween(
          firstDispatchAt,
          booking.pickupDueTime,
        ),
      typeOfBooking:
        booking.typeOfBooking,
      bookingSource:
        booking.bookingSource,
      pickupZone:
        booking.locations[0]
          ?.zoneName ??
        null,
      estimatedValue:
        Number(
          estimatedValue.toFixed(2),
        ),
    });
  }

  jobs.sort(
    (first, second) =>
      second
        .effectiveDriverRejections -
        first
          .effectiveDriverRejections ||
      second.rawRejectionAttempts -
        first.rawRejectionAttempts ||
      (
        second.lastRejectedAt ??
        ""
      ).localeCompare(
        first.lastRejectedAt ??
        "",
      ),
  );

  const bucketDefinitions =
    [
      {
        bucket:
          "1" as const,
        matches:
          (count: number) =>
            count === 1,
      },
      {
        bucket:
          "2" as const,
        matches:
          (count: number) =>
            count === 2,
      },
      {
        bucket:
          "3" as const,
        matches:
          (count: number) =>
            count === 3,
      },
      {
        bucket:
          "4+" as const,
        matches:
          (count: number) =>
            count >= 4,
      },
    ];

  const positiveBuckets =
    bucketDefinitions.map(
      ({
        bucket,
        matches,
      }) => {
        const matching =
          jobs.filter(
            (job) =>
              matches(
                job.effectiveDriverRejections,
              ),
          );

        const cancelled =
          matching.filter(
            (job) =>
              job.finalOutcome ===
              "CANCELLED",
          ).length;

        const acceptanceTimes =
          matching
            .map(
              (job) =>
                job.secondsFromFirstDispatchToAcceptance,
            )
            .filter(
              (
                value,
              ): value is number =>
                value !== null,
            );

        return {
          bucket,
          jobs:
            matching.length,
          cancelledJobs:
            cancelled,
          cancellationRate:
            percentage(
              cancelled,
              matching.length,
            ),
          acceptedJobs:
            acceptanceTimes.length,
          averageSecondsToAcceptance:
            acceptanceTimes.length > 0
              ? Math.round(
                  acceptanceTimes.reduce(
                    (
                      total,
                      value,
                    ) =>
                      total +
                      value,
                    0,
                  ) /
                    acceptanceTimes.length,
                )
              : null,
        };
      },
    );

  const buckets:
    DispatchDifficultyBucket[] = [
      controlBucket,
      ...positiveBuckets,
    ];

  const cancelledAfterRejection =
    jobs.filter(
      (job) =>
        job.finalOutcome ===
        "CANCELLED",
    ).length;

  const acceptedJobs =
    jobs.filter(
      (job) =>
        job.acceptedAt !==
        null,
    );

  const acceptanceTimes =
    acceptedJobs
      .map(
        (job) =>
          job.secondsFromFirstDispatchToAcceptance,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  return {
    summary: {
      ...rejectionReport.summary,
      cohortJobs:
        controlJobs +
        jobs.length,
      noRejectionJobs:
        controlJobs,
      recoveredOnlyJobs:
        jobs.filter(
          (job) =>
            job.rawRejectionAttempts >
              0 &&
            job.effectiveDriverRejections ===
              0 &&
            job.recoveredDriverRejections >
              0,
        ).length,
      affectedJobs:
        jobs.length,
      acceptedAfterRejection:
        acceptedJobs.length,
      completedAfterRejection:
        jobs.filter(
          (job) =>
            job.finalOutcome ===
            "COMPLETED",
        ).length,
      cancelledAfterRejection,
      noFareAfterRejection:
        jobs.filter(
          (job) =>
            job.finalOutcome ===
            "NO_FARE",
        ).length,
      cancellationRateAfterRejection:
        percentage(
          cancelledAfterRejection,
          jobs.length,
        ),
      averageSecondsToAcceptance:
        acceptanceTimes.length > 0
          ? Math.round(
              acceptanceTimes.reduce(
                (
                  total,
                  value,
                ) =>
                  total +
                  value,
                0,
              ) /
                acceptanceTimes.length,
            )
          : null,
    },
    buckets,
    jobs,
  };
}
