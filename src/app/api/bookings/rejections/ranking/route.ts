import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  getEffectiveDriverRejectionReport,
} from "@/lib/refusals/effective-driver-rejections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
