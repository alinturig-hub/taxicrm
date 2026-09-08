import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export type RejectionTimelineEvent = {
  bookingId: string;
  driverId: string | null;
  type:
    | "REJECTED"
    | "ACCEPTED";
  occurredAt: number;
};

export function classifyDriverRejectionTimeline(
  events:
    RejectionTimelineEvent[],
) {
  const rejections =
    events.filter(
      (event) =>
        event.type ===
        "REJECTED",
    );

  const attributed =
    rejections.filter(
      (
        event,
      ): event is RejectionTimelineEvent & {
        driverId: string;
      } =>
        typeof event.driverId ===
          "string" &&
        event.driverId.length > 0,
    );

  const latestByPair =
    new Map<
      string,
      RejectionTimelineEvent & {
        driverId: string;
      }
    >();

  for (
    const rejection
    of attributed
  ) {
    const key =
      JSON.stringify([
        rejection.bookingId,
        rejection.driverId,
      ]);

    const existing =
      latestByPair.get(
        key,
      );

    if (
      !existing ||
      rejection.occurredAt >
        existing.occurredAt
    ) {
      latestByPair.set(
        key,
        rejection,
      );
    }
  }

  const pairs =
    Array.from(
      latestByPair.values(),
    ).map(
      (rejection) => {
        const recovered =
          events.some(
            (event) =>
              event.type ===
                "ACCEPTED" &&
              event.bookingId ===
                rejection.bookingId &&
              event.driverId ===
                rejection.driverId &&
              event.occurredAt >
                rejection.occurredAt,
          );

        return {
          bookingId:
            rejection.bookingId,
          driverId:
            rejection.driverId,
          rejectedAt:
            rejection.occurredAt,
          recovered,
        };
      },
    );

  const effectivePairs =
    pairs.filter(
      (pair) =>
        !pair.recovered,
    );

  return {
    rawRejectionAttempts:
      rejections.length,
    attributedRejectionAttempts:
      attributed.length,
    unattributedRejectionAttempts:
      rejections.length -
      attributed.length,
    duplicateRejectionAttempts:
      attributed.length -
      pairs.length,
    uniqueBookingDriverPairs:
      pairs.length,
    recoveredBySameDriver:
      pairs.length -
      effectivePairs.length,
    effectiveDriverRejections:
      effectivePairs.length,
    pairs,
    effectivePairs,
  };
}

export type EffectiveRejectionDetail = {
  bookingId: string;
  driverId: string;
  callsign: string | null;
  forename: string | null;
  surname: string | null;
  rejectedAt: Date;
  estimatedValue: number;
};

export type EffectiveRejectionSummary = {
  rawRejectionAttempts: number;
  attributedRejectionAttempts: number;
  unattributedRejectionAttempts: number;
  duplicateRejectionAttempts: number;
  uniqueBookingDriverPairs: number;
  recoveredBySameDriver: number;
  effectiveDriverRejections: number;
  jobsRejectedAtLeastOnce: number;
  driversWhoRejected: number;
  averageEffectiveRejectionsPerAffectedJob: number;
  attributionPercent: number;
};

export type EffectiveDriverRankingEntry = {
  driverId: string;
  callsign: string | null;
  forename: string | null;
  surname: string | null;
  rejectedJobs: number;
  estimatedLostRevenue: number;
  rejections: Array<{
    bookingId: string;
    rejectedAt: Date;
    estimatedValue: number;
  }>;
};

type SummaryRow = {
  rawRejectionAttempts: bigint;
  attributedRejectionAttempts: bigint;
  uniqueBookingDriverPairs: bigint;
  recoveredBySameDriver: bigint;
  effectiveDriverRejections: bigint;
  jobsRejectedAtLeastOnce: bigint;
  driversWhoRejected: bigint;
};

type DetailRow = {
  bookingId: string;
  driverId: string;
  callsign: string | null;
  forename: string | null;
  surname: string | null;
  rejectedAt: Date;
  estimatedValue: unknown;
  recovered: boolean;
};

type RejectionPeriodBasis =
  | "REJECTION_RECEIVED"
  | "PICKUP_DUE";

function rejectionCte(
  from: string,
  to: string,
  periodBasis:
    RejectionPeriodBasis =
      "REJECTION_RECEIVED",
) {
  const periodFilter =
    periodBasis ===
    "PICKUP_DUE"
      ? Prisma.sql`
          EXISTS (
            SELECT 1
            FROM "Booking" booking
            WHERE
              booking.provider =
                'AUTOCAB'
              AND booking."externalId" =
                rejected."externalBookingId"
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
          )
        `
      : Prisma.sql`
          (
            rejected."receivedAt"
              AT TIME ZONE
                'Europe/London'
          )::date >=
            CAST(${from} AS date)
          AND (
            rejected."receivedAt"
              AT TIME ZONE
                'Europe/London'
          )::date <=
            CAST(${to} AS date)
        `;

  return Prisma.sql`
    WITH raw_rejections AS MATERIALIZED (
      SELECT
        rejected.id,
        rejected."externalBookingId" AS booking_id,
        rejected."receivedAt" AS rejected_at,
        COALESCE(
          NULLIF(
            rejected.payload->'Pricing'->>'Price',
            ''
          )::numeric,
          NULLIF(
            rejected.payload->'PriceComparison'
              ->>'SystemEstimatedPrice',
            ''
          )::numeric,
          NULLIF(
            rejected.payload->'Pricing'->>'Fare',
            ''
          )::numeric,
          0
        ) AS estimated_value
      FROM "WebhookEvent" rejected
      WHERE
        rejected."eventType" = 'BookingRejected'
        AND rejected.status = 'PROCESSED'
        AND (
          ${periodFilter}
        )
    ),
    attributed_rejections AS MATERIALIZED (
      SELECT
        raw.id,
        raw.booking_id,
        raw.rejected_at,
        raw.estimated_value,
        driver.driver_id,
        driver.callsign,
        driver.forename,
        driver.surname
      FROM raw_rejections raw
      JOIN LATERAL (
        SELECT
          modified.payload->'Driver'->>'Id'
            AS driver_id,
          modified.payload->'Driver'->>'Callsign'
            AS callsign,
          modified.payload->'Driver'->>'Forename'
            AS forename,
          modified.payload->'Driver'->>'Surname'
            AS surname
        FROM "WebhookEvent" modified
        WHERE
          modified."externalBookingId" =
            raw.booking_id
          AND modified."eventType" =
            'BookingModified'
          AND modified.status = 'PROCESSED'
          AND modified."receivedAt" <
            raw.rejected_at
          AND modified.payload->'Driver'->>'Id'
            IS NOT NULL
        ORDER BY modified."receivedAt" DESC
        LIMIT 1
      ) driver ON TRUE
    ),
    latest_rejections AS MATERIALIZED (
      SELECT DISTINCT ON (
        rejection.booking_id,
        rejection.driver_id
      )
        rejection.booking_id,
        rejection.driver_id,
        rejection.callsign,
        rejection.forename,
        rejection.surname,
        rejection.rejected_at,
        rejection.estimated_value
      FROM attributed_rejections rejection
      ORDER BY
        rejection.booking_id,
        rejection.driver_id,
        rejection.rejected_at DESC
    ),
    classified_rejections AS MATERIALIZED (
      SELECT
        rejection.*,
        EXISTS (
          SELECT 1
          FROM "WebhookEvent" accepted
          JOIN LATERAL (
            SELECT
              modified.payload->'Driver'->>'Id'
                AS driver_id
            FROM "WebhookEvent" modified
            WHERE
              modified."externalBookingId" =
                accepted."externalBookingId"
              AND modified."eventType" =
                'BookingModified'
              AND modified.status = 'PROCESSED'
              AND modified."receivedAt" <
                accepted."receivedAt"
              AND modified.payload->'Driver'->>'Id'
                IS NOT NULL
            ORDER BY modified."receivedAt" DESC
            LIMIT 1
          ) accepted_driver ON TRUE
          WHERE
            accepted."externalBookingId" =
              rejection.booking_id
            AND accepted."eventType" =
              'BookingDispatchAccepted'
            AND accepted.status = 'PROCESSED'
            AND accepted."receivedAt" >
              rejection.rejected_at
            AND accepted_driver.driver_id =
              rejection.driver_id
        ) AS recovered
      FROM latest_rejections rejection
    )
  `;
}

async function buildEffectiveDriverRejectionReport(
  from: string,
  to: string,
  periodBasis:
    RejectionPeriodBasis =
      "REJECTION_RECEIVED",
) {
  const summaryRows =
    await prisma.$queryRaw<SummaryRow[]>(
      Prisma.sql`
        ${rejectionCte(
          from,
          to,
          periodBasis,
        )}
        SELECT
          (
            SELECT COUNT(*)
            FROM raw_rejections
          )::bigint AS "rawRejectionAttempts",
          (
            SELECT COUNT(*)
            FROM attributed_rejections
          )::bigint AS "attributedRejectionAttempts",
          (
            SELECT COUNT(*)
            FROM latest_rejections
          )::bigint AS "uniqueBookingDriverPairs",
          COUNT(*) FILTER (
            WHERE recovered
          )::bigint AS "recoveredBySameDriver",
          COUNT(*) FILTER (
            WHERE NOT recovered
          )::bigint AS "effectiveDriverRejections",
          COUNT(
            DISTINCT booking_id
          ) FILTER (
            WHERE NOT recovered
          )::bigint AS "jobsRejectedAtLeastOnce",
          COUNT(
            DISTINCT driver_id
          ) FILTER (
            WHERE NOT recovered
          )::bigint AS "driversWhoRejected"
        FROM classified_rejections
      `,
    );

  const detailRows =
    await prisma.$queryRaw<DetailRow[]>(
      Prisma.sql`
        ${rejectionCte(
          from,
          to,
          periodBasis,
        )}
        SELECT
          booking_id AS "bookingId",
          driver_id AS "driverId",
          callsign,
          forename,
          surname,
          rejected_at AS "rejectedAt",
          estimated_value AS "estimatedValue",
          recovered
        FROM classified_rejections
        ORDER BY rejected_at DESC
      `,
    );

  const raw =
    Number(
      summaryRows[0]?.rawRejectionAttempts ??
        0,
    );

  const attributed =
    Number(
      summaryRows[0]
        ?.attributedRejectionAttempts ??
        0,
    );

  const uniquePairs =
    Number(
      summaryRows[0]
        ?.uniqueBookingDriverPairs ??
        0,
    );

  const effective =
    Number(
      summaryRows[0]
        ?.effectiveDriverRejections ??
        0,
    );

  const affectedJobs =
    Number(
      summaryRows[0]
        ?.jobsRejectedAtLeastOnce ??
        0,
    );

  const summary: EffectiveRejectionSummary = {
    rawRejectionAttempts:
      raw,
    attributedRejectionAttempts:
      attributed,
    unattributedRejectionAttempts:
      Math.max(
        raw - attributed,
        0,
      ),
    duplicateRejectionAttempts:
      Math.max(
        attributed - uniquePairs,
        0,
      ),
    uniqueBookingDriverPairs:
      uniquePairs,
    recoveredBySameDriver:
      Number(
        summaryRows[0]
          ?.recoveredBySameDriver ??
          0,
      ),
    effectiveDriverRejections:
      effective,
    jobsRejectedAtLeastOnce:
      affectedJobs,
    driversWhoRejected:
      Number(
        summaryRows[0]
          ?.driversWhoRejected ??
          0,
      ),
    averageEffectiveRejectionsPerAffectedJob:
      affectedJobs > 0
        ? Number(
            (
              effective /
              affectedJobs
            ).toFixed(2),
          )
        : 0,
    attributionPercent:
      raw > 0
        ? Number(
            (
              (
                attributed /
                raw
              ) *
              100
            ).toFixed(2),
          )
        : 0,
  };

  const classifiedDetails =
    detailRows.map((row) => ({
      bookingId:
        row.bookingId,
      driverId:
        row.driverId,
      callsign:
        row.callsign,
      forename:
        row.forename,
      surname:
        row.surname,
      rejectedAt:
        row.rejectedAt,
      estimatedValue:
        Number(
          row.estimatedValue ??
            0,
        ),
      recovered:
        row.recovered,
    }));

  const details: EffectiveRejectionDetail[] =
    classifiedDetails
      .filter(
        (row) =>
          !row.recovered,
      )
      .map(
        (row) => ({
          bookingId:
            row.bookingId,
          driverId:
            row.driverId,
          callsign:
            row.callsign,
          forename:
            row.forename,
          surname:
            row.surname,
          rejectedAt:
            row.rejectedAt,
          estimatedValue:
            row.estimatedValue,
        }),
      );

  const rankingByDriver =
    new Map<
      string,
      EffectiveDriverRankingEntry
    >();

  for (const rejection of details) {
    const existing =
      rankingByDriver.get(
        rejection.driverId,
      );

    const item = {
      bookingId:
        rejection.bookingId,
      rejectedAt:
        rejection.rejectedAt,
      estimatedValue:
        Math.max(
          rejection.estimatedValue,
          0,
        ),
    };

    if (existing) {
      existing.rejectedJobs += 1;
      existing.estimatedLostRevenue +=
        item.estimatedValue;
      existing.rejections.push(item);
      continue;
    }

    rankingByDriver.set(
      rejection.driverId,
      {
        driverId:
          rejection.driverId,
        callsign:
          rejection.callsign,
        forename:
          rejection.forename,
        surname:
          rejection.surname,
        rejectedJobs:
          1,
        estimatedLostRevenue:
          item.estimatedValue,
        rejections: [item],
      },
    );
  }

  const ranking =
    Array.from(
      rankingByDriver.values(),
    )
      .map((driver) => ({
        ...driver,
        estimatedLostRevenue:
          Number(
            driver
              .estimatedLostRevenue
              .toFixed(2),
          ),
        rejections:
          driver.rejections.sort(
            (first, second) =>
              second.rejectedAt.getTime() -
              first.rejectedAt.getTime(),
          ),
      }))
      .sort(
        (first, second) =>
          second.rejectedJobs -
            first.rejectedJobs ||
          (
            first.callsign ??
            ""
          ).localeCompare(
            second.callsign ??
              "",
            "en",
            {
              numeric: true,
            },
          ),
      );

  return {
    summary,
    details,
    classifiedDetails,
    ranking,
  };
}

const REPORT_CACHE_TTL_MS =
  5 * 60 * 1000;

type EffectiveReport =
  Awaited<
    ReturnType<
      typeof buildEffectiveDriverRejectionReport
    >
  >;

const reportCache =
  new Map<
    string,
    {
      expiresAt: number;
      promise: Promise<EffectiveReport>;
    }
  >();

export function getEffectiveDriverRejectionReport(
  from: string,
  to: string,
) {
  const key =
    `${from}:${to}`;

  const now =
    Date.now();

  const cached =
    reportCache.get(
      key,
    );

  if (
    cached &&
    cached.expiresAt >
      now
  ) {
    return cached.promise;
  }

  const promise =
    buildEffectiveDriverRejectionReport(
      from,
      to,
    ).catch(
      (error) => {
        reportCache.delete(
          key,
        );

        throw error;
      },
    );

  reportCache.set(
    key,
    {
      expiresAt:
        now +
        REPORT_CACHE_TTL_MS,
      promise,
    },
  );

  if (
    reportCache.size >
    20
  ) {
    reportCache.forEach(
      (
        entry,
        cachedKey,
      ) => {
        if (
          entry.expiresAt <=
          now
        ) {
          reportCache.delete(
            cachedKey,
          );
        }
      },
    );
  }

  return promise;
}

export async function getEffectiveDriverRejectionReportByPickupPeriod(
  from: string,
  to: string,
) {
  return buildEffectiveDriverRejectionReport(
    from,
    to,
    "PICKUP_DUE",
  );
}

type DriverRejectionRow = {
  bookingId: string;
  driverId: string;
  rejectedAt: Date;
};

async function loadEffectiveDriverRejections(
  externalDriverId: string,
  from: Date,
  to: Date,
) {
  const rows =
    await prisma.$queryRaw<
      DriverRejectionRow[]
    >(
      Prisma.sql`
        WITH attributed_rejections AS MATERIALIZED (
          SELECT
            rejected."externalBookingId"
              AS booking_id,
            rejected."receivedAt"
              AS rejected_at,
            driver.driver_id
          FROM "WebhookEvent" rejected
          JOIN LATERAL (
            SELECT
              modified.payload->'Driver'->>'Id'
                AS driver_id
            FROM "WebhookEvent" modified
            WHERE
              modified."externalBookingId" =
                rejected."externalBookingId"
              AND modified."eventType" =
                'BookingModified'
              AND modified.status =
                'PROCESSED'
              AND modified."receivedAt" <
                rejected."receivedAt"
              AND modified.payload->'Driver'->>'Id'
                IS NOT NULL
            ORDER BY
              modified."receivedAt" DESC
            LIMIT 1
          ) driver ON TRUE
          WHERE
            rejected."eventType" =
              'BookingRejected'
            AND rejected.status =
              'PROCESSED'
            AND rejected."receivedAt" >=
              ${from}
            AND rejected."receivedAt" <
              ${to}
            AND driver.driver_id =
              ${externalDriverId}
        ),
        latest_rejections AS MATERIALIZED (
          SELECT DISTINCT ON (
            rejection.booking_id,
            rejection.driver_id
          )
            rejection.booking_id,
            rejection.driver_id,
            rejection.rejected_at
          FROM attributed_rejections rejection
          ORDER BY
            rejection.booking_id,
            rejection.driver_id,
            rejection.rejected_at DESC
        )
        SELECT
          rejection.booking_id AS "bookingId",
          rejection.driver_id AS "driverId",
          rejection.rejected_at AS "rejectedAt"
        FROM latest_rejections rejection
        WHERE NOT EXISTS (
          SELECT 1
          FROM "WebhookEvent" accepted
          JOIN LATERAL (
            SELECT
              modified.payload->'Driver'->>'Id'
                AS driver_id
            FROM "WebhookEvent" modified
            WHERE
              modified."externalBookingId" =
                accepted."externalBookingId"
              AND modified."eventType" =
                'BookingModified'
              AND modified.status =
                'PROCESSED'
              AND modified."receivedAt" <
                accepted."receivedAt"
              AND modified.payload->'Driver'->>'Id'
                IS NOT NULL
            ORDER BY
              modified."receivedAt" DESC
            LIMIT 1
          ) accepted_driver ON TRUE
          WHERE
            accepted."externalBookingId" =
              rejection.booking_id
            AND accepted."eventType" =
              'BookingDispatchAccepted'
            AND accepted.status =
              'PROCESSED'
            AND accepted."receivedAt" >
              rejection.rejected_at
            AND accepted_driver.driver_id =
              rejection.driver_id
        )
        ORDER BY rejection.rejected_at DESC
      `,
    );

  return rows;
}

export async function countEffectiveDriverRejections(
  externalDriverId: string,
  from: Date,
  to: Date,
) {
  const rejections =
    await loadEffectiveDriverRejections(
      externalDriverId,
      from,
      to,
    );

  return rejections.length;
}

export async function getEffectiveDriverRejectionDetails(
  externalDriverId: string,
  from: Date,
  to: Date,
) {
  return loadEffectiveDriverRejections(
    externalDriverId,
    from,
    to,
  );
}
