import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeApiResponse } from "@/lib/integrations/autocab/generic-api-sync/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({success: false, error: "UNAUTHORIZED"}, {status: 401});
  if (!await canManageIntegration(session.user.email)) return NextResponse.json({success: false, error: "FORBIDDEN"}, {status: 403});
  const {id} = await context.params;
  const endpoint = await prisma.apiEndpointConfiguration.findUnique({where: {id}});
  if (!endpoint) return NextResponse.json({success: false, error: "NOT_FOUND"}, {status: 404});
  if (!endpoint.lastTestedAt) return NextResponse.json({success: false, message: "Preview this API first."}, {status: 400});
  const body = await request.json().catch(() => null);
  if (!body || typeof body.recordKey !== "string") return NextResponse.json({success: false, message: "Supply Record Key, or leave it blank to store the whole response."}, {status: 400});
  try {
    const stored = await storeApiResponse(id, endpoint.sampleResponse, body.recordKey.trim() || null);
    return NextResponse.json({success: true, stored});
  } catch (error) {
    return NextResponse.json({success: false, message: error instanceof Error ? error.message : "Save failed."}, {status: 400});
  }
}

async function canManageIntegration(
  email: string | null | undefined,
) {
  if (!email) {
    return false;
  }

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

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const session =
    await getServerSession(authOptions);

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
    const { id } = await context.params;

    const endpoint =
      await prisma.apiEndpointConfiguration.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
        },
      });

    if (!endpoint) {
      return NextResponse.json(
        {
          success: false,
          error: "NOT_FOUND",
          message: "API endpoint not found.",
        },
        { status: 404 },
      );
    }

    await prisma.apiEndpointConfiguration.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `${endpoint.name} deleted.`,
    });
  } catch (error) {
    console.error(
      "API endpoint delete failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "DELETE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "API endpoint could not be deleted.",
      },
      { status: 500 },
    );
  }
}
