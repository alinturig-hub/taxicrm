import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await prisma.webhookEvent.findMany({
    orderBy: {
      receivedAt: "desc",
    },
    take: 100,
    select: {
      id: true,
      eventType: true,
      externalBookingId: true,
      status: true,
      receivedAt: true,
      processedAt: true,
    },
  });

  return NextResponse.json(events);
}
