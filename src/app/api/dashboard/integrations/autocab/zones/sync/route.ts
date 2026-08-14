import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncAutocabZones } from "@/lib/integrations/autocab/zone-sync/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function canManageIntegration(
  email: string | null | undefined,
) {
  if (!email) return false;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      role: true,
      isActive: true,
    },
  });

  return Boolean(
    user?.isActive &&
      (user.role === "ADMIN" ||
        user.role === "MANAGER"),
  );
}

export async function POST() {
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

  if (
    !(await canManageIntegration(
      session.user.email,
    ))
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN",
      },
      { status: 403 },
    );
  }

  try {
    const result = await syncAutocabZones();

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      "Autocab zone sync failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "AUTOCAB_ZONE_SYNC_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Zone sync failed.",
      },
      { status: 500 },
    );
  }
}
