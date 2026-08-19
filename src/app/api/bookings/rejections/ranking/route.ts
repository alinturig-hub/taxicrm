import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPERATIONAL_TIME_ZONE = "Europe/London";
const DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;

type RankingRow = {
  driverId: string;
  callsign: string | null;
  forename: string | null;
  surname: string | null;
  rejectedJobs: bigint;
  estimatedLostRevenue: unknown;
};

type CoverageRow = {
  totalRejections: bigint;
  attributedRejections: bigint;
};

function getCurrentLondonDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return [
    value("year"),
    value("month"),
    value("day"),
  ].join("-");
}

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const today = getCurrentLondonDate();
    const from = url.searchParams.get("from") ?? today;
    const to = url.searchParams.get("to") ?? from;

    if (!isValidDate(from) || !isValidDate(to)) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_DATE_RANGE",
          message: "Expected dates in YYYY-MM-DD format.",
        },
        {
          status: 400,
        },
      );
    }

    if (from > to) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_DATE_RANGE",
          message: "From date must be before or equal to To date.",
        },
        {
          status: 400,
        },
      );
    }

    const ranking = await prisma.$queryRaw<RankingRow[]>`
      WITH attributed_rejections AS (
        SELECT
          modified.driver_id AS "driverId",
          modified.callsign,
          modified.forename,
          modified.surname,
          COALESCE(
            NULLIF(rejected.payload->'Pricing'->>'Price', '')::numeric,
            NULLIF(
              rejected.payload->'PriceComparison'
                ->>'SystemEstimatedPrice',
              ''
            )::numeric,
            NULLIF(rejected.payload->'Pricing'->>'Fare', '')::numeric,
            0
          ) AS estimated_value
        FROM "WebhookEvent" rejected
        JOIN LATERAL (
          SELECT
            candidate.payload->'Driver'->>'Id' AS driver_id,
            candidate.payload->'Driver'->>'Callsign' AS callsign,
            candidate.payload->'Driver'->>'Forename' AS forename,
            candidate.payload->'Driver'->>'Surname' AS surname
          FROM "WebhookEvent" candidate
          WHERE candidate."externalBookingId" =
                rejected."externalBookingId"
            AND candidate."eventType" = 'BookingModified'
            AND candidate."receivedAt" < rejected."receivedAt"
            AND candidate.payload->'Driver'->>'Id' IS NOT NULL
          ORDER BY candidate."receivedAt" DESC
          LIMIT 1
        ) modified ON TRUE
        WHERE rejected."eventType" = 'BookingRejected'
          AND rejected.status = 'PROCESSED'
          AND (
            rejected."receivedAt"
              AT TIME ZONE 'Europe/London'
          )::date >= CAST(${from} AS date)
          AND (
            rejected."receivedAt"
              AT TIME ZONE 'Europe/London'
          )::date <= CAST(${to} AS date)
      )
      SELECT
        "driverId",
        callsign,
        forename,
        surname,
        COUNT(*)::bigint AS "rejectedJobs",
        SUM(
          CASE
            WHEN estimated_value > 0 THEN estimated_value
            ELSE 0
          END
        ) AS "estimatedLostRevenue"
      FROM attributed_rejections
      GROUP BY
        "driverId",
        callsign,
        forename,
        surname
      ORDER BY
        "rejectedJobs" DESC,
        callsign ASC NULLS LAST
      LIMIT 50
    `;

    const coverage = await prisma.$queryRaw<CoverageRow[]>`
      SELECT
        COUNT(*)::bigint AS "totalRejections",
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM "WebhookEvent" modified
            WHERE modified."externalBookingId" =
                  rejected."externalBookingId"
              AND modified."eventType" = 'BookingModified'
              AND modified."receivedAt" <
                  rejected."receivedAt"
              AND modified.payload->'Driver'->>'Id'
                  IS NOT NULL
          )
        )::bigint AS "attributedRejections"
      FROM "WebhookEvent" rejected
      WHERE rejected."eventType" = 'BookingRejected'
        AND rejected.status = 'PROCESSED'
        AND (
          rejected."receivedAt"
            AT TIME ZONE 'Europe/London'
        )::date >= CAST(${from} AS date)
        AND (
          rejected."receivedAt"
            AT TIME ZONE 'Europe/London'
        )::date <= CAST(${to} AS date)
    `;

    const totalRejections =
      Number(coverage[0]?.totalRejections ?? 0);

    const attributedRejections =
      Number(coverage[0]?.attributedRejections ?? 0);

    return NextResponse.json({
      success: true,
      from,
      to,
      totalRejections,
      attributedRejections,
      attributionPercent:
        totalRejections > 0
          ? Number(
              (
                (attributedRejections / totalRejections) *
                100
              ).toFixed(2),
            )
          : 0,
      ranking: ranking.map((row, index) => ({
        rank: index + 1,
        driverId: row.driverId,
        callsign: row.callsign,
        driverName:
          [row.forename, row.surname]
            .filter(Boolean)
            .join(" ") || "Unknown Driver",
        rejectedJobs: Number(row.rejectedJobs),
        estimatedLostRevenue:
          Number(row.estimatedLostRevenue ?? 0),
      })),
    });
  } catch (error) {
    console.error(
      "Booking rejection ranking failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "REJECTION_RANKING_FAILED",
        message:
          "The rejection ranking could not be generated.",
      },
      {
        status: 500,
      },
    );
  }
}
