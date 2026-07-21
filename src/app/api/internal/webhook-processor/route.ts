import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { processWebhookEvent } from "@/lib/autocab/process-webhook-event";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");

  if (
    !process.env.CRON_SECRET ||
    secret !== process.env.CRON_SECRET
  ) {
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

  const events = await prisma.webhookEvent.findMany({
    where: {
      status: "RECEIVED",
    },
    orderBy: {
      receivedAt: "asc",
    },
    take: 25,
    select: {
      id: true,
    },
  });

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await processWebhookEvent(event.id);
      processed++;
    } catch (error) {
      console.error(
        `Webhook processing failed for ${event.id}:`,
        error,
      );
      failed++;
    }
  }

  const remaining = await prisma.webhookEvent.count({
    where: {
      status: "RECEIVED",
    },
  });

  return NextResponse.json({
    success: true,
    processed,
    failed,
    remaining,
  });
}
