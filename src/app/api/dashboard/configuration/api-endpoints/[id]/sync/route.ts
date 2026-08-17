import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { syncGenericApiEndpoint } from "@/lib/integrations/autocab/generic-api-sync/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
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

  const user = session.user as {
    role?: string;
  };

  if (
    user.role !== "ADMIN" &&
    user.role !== "MANAGER"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "FORBIDDEN",
        message:
          "Administrator or manager access is required.",
      },
      { status: 403 },
    );
  }

  try {
    const { id } = await context.params;

    const result =
      await syncGenericApiEndpoint(id);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error(
      "Generic API endpoint sync failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "API_ENDPOINT_SYNC_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "API endpoint synchronization failed.",
      },
      { status: 500 },
    );
  }
}
