import { getServerSession } from "next-auth";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { authOptions } from "@/lib/auth";
import { getLiveOperations } from "@/lib/operations/live-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseMinutes(
  value: string | null,
  fallback: number,
): number {
  if (value === null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    1440,
    Math.max(0, Math.round(parsed)),
  );
}

export async function GET(request: NextRequest) {
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
    const pastMinutes = parseMinutes(
      request.nextUrl.searchParams.get("pastMinutes"),
      60,
    );

    const futureMinutes = parseMinutes(
      request.nextUrl.searchParams.get("futureMinutes"),
      120,
    );

    const operations = await getLiveOperations({
      pastMinutes,
      futureMinutes,
    });

    return NextResponse.json(
      {
        success: true,
        refreshAfterSeconds: 3,
        operations,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Live operations retrieval failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "LIVE_OPERATIONS_LOAD_FAILED",
        message:
          "Live operational data could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}
