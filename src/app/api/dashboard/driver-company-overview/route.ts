import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { getDriverCompanyOverviewForRange } from "@/lib/analytics/driver-company-overview";
import { authOptions } from "@/lib/auth";
import {
  addLondonDays,
  startOfLondonDay,
  startOfLondonWeek,
} from "@/lib/time/london-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATE_PATTERN = /^\\d{4}-\\d{2}-\\d{2}$/;
const MAX_DAYS = 366;

function parseLondonDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const utcNoon = new Date(
    Date.UTC(year, month - 1, day, 12),
  );

  if (
    utcNoon.getUTCFullYear() !== year ||
    utcNoon.getUTCMonth() + 1 !== month ||
    utcNoon.getUTCDate() !== day
  ) {
    return null;
  }

  return startOfLondonDay(utcNoon);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

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

  try {
    const url = new URL(request.url);
    const preset =
      url.searchParams.get("preset");

    let from: Date;
    let to: Date;

    if (
      preset === "this-week" ||
      preset === "last-week"
    ) {
      const thisWeek =
        startOfLondonWeek(new Date());

      from =
        preset === "last-week"
          ? addLondonDays(thisWeek, -7)
          : thisWeek;

      to = addLondonDays(from, 7);
    } else {
      const fromValue =
        url.searchParams.get("from");
      const toValue =
        url.searchParams.get("to");

      if (!fromValue || !toValue) {
        return NextResponse.json(
          {
            success: false,
            error: "INVALID_DATE_RANGE",
            message:
              "Both From and To dates are required.",
          },
          {
            status: 400,
          },
        );
      }

      const parsedFrom =
        parseLondonDate(fromValue);
      const parsedTo =
        parseLondonDate(toValue);

      if (
        !parsedFrom ||
        !parsedTo ||
        parsedFrom > parsedTo
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "INVALID_DATE_RANGE",
            message:
              "Expected a valid date range.",
          },
          {
            status: 400,
          },
        );
      }

      from = parsedFrom;
      to = addLondonDays(parsedTo, 1);

      const totalDays = Math.round(
        (
          to.getTime() - from.getTime()
        ) / 86_400_000,
      );

      if (totalDays > MAX_DAYS) {
        return NextResponse.json(
          {
            success: false,
            error: "DATE_RANGE_TOO_LARGE",
            message:
              `Maximum range is ${MAX_DAYS} days.`,
          },
          {
            status: 400,
          },
        );
      }
    }

    const overview =
      await getDriverCompanyOverviewForRange(
        from,
        to,
      );

    return NextResponse.json({
      success: true,
      overview,
    });
  } catch (error) {
    console.error(
      "Driver company overview failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "DRIVER_COMPANY_OVERVIEW_FAILED",
        message:
          "Driver and company figures could not be calculated.",
      },
      {
        status: 500,
      },
    );
  }
}
