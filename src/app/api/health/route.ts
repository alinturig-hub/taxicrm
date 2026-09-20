import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "healthy",
        database: "connected",
        checkedAt:
          new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "cache-control":
            "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "unavailable",
        checkedAt:
          new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "cache-control":
            "no-store",
        },
      },
    );
  }
}
