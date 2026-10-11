import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
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

  const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) return NextResponse.json({success: false, message: "Invalid page."}, {status: 400});
  const pageSize = 100;
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
        sampleResponse: true,
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
        take: pageSize, skip: (page - 1) * pageSize,
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
    pagination: {page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize))},
    records,
  });
}
