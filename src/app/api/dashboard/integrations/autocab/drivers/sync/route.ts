import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { syncAutocabDrivers } from "@/lib/integrations/autocab/driver-sync/sync";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function canManageIntegration(
  email: string | null | undefined,
) {
  if (!email) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
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
      {
        status: 401,
      },
    );
  }

  if (
    !(await canManageIntegration(session.user.email))
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN",
      },
      {
        status: 403,
      },
    );
  }

  try {
    const result = await syncAutocabDrivers("MANUAL");

    return NextResponse.json({
      success: true,
      message: result.message,
      result: {
        jobId: result.jobId,
        status: result.status,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        durationMs: result.durationMs,
        recordsReceived: result.recordsReceived,
        recordsEligible: result.recordsEligible,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsSkipped: result.recordsSkipped,
        recordsDisabled: result.recordsDisabled,
        recordsFailed: result.recordsFailed,
        nextSyncAt: result.nextSyncAt,
      },
    });
  } catch (error) {
    console.error(
      "Manual Autocab driver sync failed:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Driver synchronisation failed.";

    const status =
      message.includes("already running")
        ? 409
        : message.includes("disabled") ||
            message.includes("configuration")
          ? 400
          : 500;

    return NextResponse.json(
      {
        success: false,
        error: "AUTOCAB_DRIVER_SYNC_FAILED",
        message,
      },
      {
        status,
      },
    );
  }
}
