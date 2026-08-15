import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      { status: 401 },
    );
  }

  const zones = await prisma.zone.findMany({
    where: {
      provider: "AUTOCAB",
      companyId: 1,
      active: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      externalId: true,
      companyId: true,
      mdtZoneId: true,
      name: true,
      descriptor: true,
      latitude: true,
      longitude: true,
      active: true,
      lastSyncedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    total: zones.length,
    zones,
  });
}
