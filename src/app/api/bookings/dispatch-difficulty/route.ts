import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  getDispatchDifficultyReport,
} from "@/lib/refusals/dispatch-difficulty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_PATTERN =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function londonDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(
    new Date(),
  );
}

function positiveInteger(
  value: string | null,
  fallback: number,
) {
  const parsed =
    Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
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
      londonDate();

    const from =
      url.searchParams.get(
        "from",
      ) ??
      today;

    const to =
      url.searchParams.get(
        "to",
      ) ??
      from;

    if (
      !DATE_PATTERN.test(from) ||
      !DATE_PATTERN.test(to) ||
      from > to
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_DATE_RANGE",
        },
        {
          status: 400,
        },
      );
    }

    const page =
      positiveInteger(
        url.searchParams.get(
          "page",
        ),
        1,
      );

    const pageSize =
      Math.min(
        positiveInteger(
          url.searchParams.get(
            "pageSize",
          ),
          25,
        ),
        100,
      );

    const minimumRejections =
      Math.max(
        0,
        positiveInteger(
          url.searchParams.get(
            "minimumRejections",
          ),
          0,
        ),
      );

    const outcome =
      url.searchParams.get(
        "outcome",
      )
        ?.trim()
        .toUpperCase() ??
      null;

    const report =
      await getDispatchDifficultyReport(
        from,
        to,
      );

    const filteredJobs =
      report.jobs.filter(
        (job) =>
          job.effectiveDriverRejections >=
            minimumRejections &&
          (
            !outcome ||
            outcome === "ALL" ||
            job.finalOutcome ===
              outcome
          ),
      );

    const offset =
      (page - 1) *
      pageSize;

    return NextResponse.json({
      success: true,
      from,
      to,
      descriptiveEvidenceOnly:
        true,
      containsPersonalData:
        false,
      summary:
        report.summary,
      buckets:
        report.buckets,
      pagination: {
        page,
        pageSize,
        total:
          filteredJobs.length,
        totalPages:
          Math.max(
            1,
            Math.ceil(
              filteredJobs.length /
                pageSize,
            ),
          ),
      },
      jobs:
        filteredJobs.slice(
          offset,
          offset +
            pageSize,
        ),
    });
  } catch (error) {
    console.error(
      "Dispatch difficulty report failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "DISPATCH_DIFFICULTY_FAILED",
        message:
          "Dispatch difficulty could not be calculated.",
      },
      {
        status: 500,
      },
    );
  }
}
