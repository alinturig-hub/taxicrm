import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getLiveOperations } from "@/lib/operations/live-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
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
    const operations = await getLiveOperations();

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
