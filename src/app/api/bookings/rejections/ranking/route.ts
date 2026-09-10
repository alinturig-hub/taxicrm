import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getEffectiveDriverRejectionReport,
} from "@/lib/refusals/effective-driver-rejections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOOKING_OUTCOME_BATCH_SIZE =
  1000;

const OPERATIONAL_TIME_ZONE =
  "Europe/London";

const DATE_PATTERN =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function getCurrentLondonDate() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          OPERATIONAL_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(
      new Date(),
    );

  const value = (
    type:
      Intl.DateTimeFormatPartTypes,
  ) =>
    parts.find(
      (part) =>
        part.type === type,
    )?.value ?? "";

  return [
    value("year"),
    value("month"),
    value("day"),
  ].join("-");
}

function isValidDate(
  value: string,
) {
  if (
    !DATE_PATTERN.test(value)
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  const parsed =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  return (
    parsed.getUTCFullYear() ===
      year &&
    parsed.getUTCMonth() + 1 ===
      month &&
    parsed.getUTCDate() ===
      day
  );
}

function getFinalOutcome(
  booking: {
    status: string;
    acceptedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    noFareAt: Date | null;
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

export async function GET(
  request: Request,
) {
  try {
    const session =
      await getServerSession(
        authOptions,
      );

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        },
      );
    }

    const url =
      new URL(request.url);

    const today =
      getCurrentLondonDate();

    const from =
      url.searchParams.get(
        "from",
      ) ?? today;

    const to =
      url.searchParams.get(
        "to",
      ) ?? from;

    if (
      !isValidDate(from) ||
      !isValidDate(to)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_DATE_RANGE",
          message:
            "Expected dates in YYYY-MM-DD format.",
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
          error:
            "INVALID_DATE_RANGE",
          message:
            "From date must be before or equal to To date.",
        },
        {
          status: 400,
        },
      );
    }

    const report =
      await getEffectiveDriverRejectionReport(
        from,
        to,
      );

    const summary =
      report.summary;

    const bookingIds =
      Array.from(
        new Set(
          report.details.map(
            (rejection) =>
              rejection.bookingId,
          ),
        ),
      );

    const outcomeByBookingId =
      new Map<
        string,
        string
      >();

    for (
      let index = 0;
      index <
      bookingIds.length;
      index +=
        BOOKING_OUTCOME_BATCH_SIZE
    ) {
      const batchIds =
        bookingIds.slice(
          index,
          index +
            BOOKING_OUTCOME_BATCH_SIZE,
        );

      const bookings =
        await prisma.booking.findMany({
          where: {
            provider:
              "AUTOCAB",
            externalId: {
              in: batchIds,
            },
          },
          select: {
            externalId: true,
            status: true,
            acceptedAt: true,
            completedAt: true,
            cancelledAt: true,
            noFareAt: true,
          },
        });

      for (
        const booking
        of bookings
      ) {
        outcomeByBookingId.set(
          booking.externalId,
          getFinalOutcome(
            booking,
          ),
        );
      }
    }

    return NextResponse.json({
      success: true,
      from,
      to,

      // Backward-compatible fields now use
      // effective driver rejections.
      totalRejections:
        summary.effectiveDriverRejections,
      attributedRejections:
        summary.effectiveDriverRejections,

      ...summary,

      ranking:
        report.ranking
          .slice(0, 50)
          .map(
            (
              driver,
              index,
            ) => ({
              rank:
                index + 1,
              driverId:
                driver.driverId,
              callsign:
                driver.callsign,
              driverName:
                [
                  driver.forename,
                  driver.surname,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                "Unknown Driver",
              rejectedJobs:
                driver.rejectedJobs,
              cancelledAfterRejection:
                driver.rejections.filter(
                  (rejection) =>
                    outcomeByBookingId.get(
                      rejection.bookingId,
                    ) ===
                    "CANCELLED",
                ).length,
              noFareAfterRejection:
                driver.rejections.filter(
                  (rejection) =>
                    outcomeByBookingId.get(
                      rejection.bookingId,
                    ) ===
                    "NO_FARE",
                ).length,
              estimatedLostRevenue:
                driver.estimatedLostRevenue,
              rejections:
                driver.rejections.map(
                  (
                    rejection,
                  ) => ({
                    bookingId:
                      rejection.bookingId,
                    rejectedAt:
                      rejection.rejectedAt
                        .toISOString(),
                    estimatedValue:
                      rejection.estimatedValue,
                    finalOutcome:
                      outcomeByBookingId.get(
                        rejection.bookingId,
                      ) ??
                      "UNKNOWN",
                  }),
                ),
            }),
          ),
    });
  } catch (error) {
    console.error(
      "Booking rejection ranking failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "REJECTION_RANKING_FAILED",
        message:
          "The rejection ranking could not be generated.",
      },
      {
        status: 500,
      },
    );
  }
}
