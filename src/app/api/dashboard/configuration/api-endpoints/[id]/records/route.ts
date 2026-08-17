import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
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

  const { id } = await context.params;

  const endpoint =
    await prisma.apiEndpointConfiguration.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        url: true,
        recordKey: true,
        storeRecords: true,
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

  const [records, total, active] =
    await Promise.all([
      prisma.apiEndpointRecord.findMany({
        where: {
          endpointId: id,
        },
        orderBy: [
          {
            isActive: "desc",
          },
          {
            externalId: "asc",
          },
        ],
      }),
      prisma.apiEndpointRecord.count({
        where: {
          endpointId: id,
        },
      }),
      prisma.apiEndpointRecord.count({
        where: {
          endpointId: id,
          isActive: true,
        },
      }),
    ]);

  return NextResponse.json({
    success: true,
    endpoint,
    summary: {
      total,
      active,
      inactive: total - active,
    },
    records,
  });
}
