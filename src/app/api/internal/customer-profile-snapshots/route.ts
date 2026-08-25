import {
  NextRequest,
  NextResponse,
} from "next/server";

import { generateDailyProfileSnapshots } from "@/lib/customers/generate-daily-profile-snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
) {
  const secret =
    request.headers.get(
      "x-cron-secret",
    );

  if (
    !process.env.CRON_SECRET ||
    secret !== process.env.CRON_SECRET
  ) {
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
    const body = (await request.json().catch(
      () => ({}),
    )) as {
      limit?: unknown;
    };

    const requestedLimit =
      typeof body.limit === "number" &&
      Number.isInteger(body.limit)
        ? body.limit
        : 25;

    const result =
      await generateDailyProfileSnapshots({
        limit: requestedLimit,
        activeDays: 60,
        minimumBookings: 5,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Daily customer snapshot batch failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "CUSTOMER_SNAPSHOT_BATCH_FAILED",
        message:
          "Daily customer snapshots could not be generated.",
      },
      {
        status: 500,
      },
    );
  }
}
