import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { processWebhookEvent } from "@/lib/autocab/process-webhook-event";
import { retryableWebhooks } from "@/lib/autocab/webhook-processing";

const waitingForBooking = "Booking context event is waiting for its booking.";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
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

  if (process.env.AUTOCAB_WEBHOOK_PROCESSING_PAUSED === "true") {
    return NextResponse.json({
      success: true,
      paused: true,
      processed: 0,
      failed: 0,
      hasMore: false,
    });
  }

  // Context events can exhaust their retry count before BookingCreated arrives.
  // Requeue only those whose canonical parent is now present.
  const waiting = await prisma.webhookEvent.findMany({
    where: {
      status: "FAILED",
      processingError: waitingForBooking,
      attemptCount: { gte: 5 },
      externalBookingId: { not: null },
    },
    select: { id: true, externalBookingId: true },
    take: 100,
    orderBy: { receivedAt: "desc" },
  });
  const externalIds = Array.from(new Set(waiting.map(event => event.externalBookingId).filter((id): id is string => Boolean(id))));
  if (externalIds.length) {
    const parents = await prisma.booking.findMany({
      where: { provider: "AUTOCAB", externalId: { in: externalIds } },
      select: { externalId: true },
    });
    const found = new Set(parents.map(booking => booking.externalId));
    const ready = waiting.filter(event => event.externalBookingId && found.has(event.externalBookingId)).map(event => event.id);
    if (ready.length) {
      await prisma.webhookEvent.updateMany({
        where: { id: { in: ready }, status: "FAILED", processingError: waitingForBooking },
        data: { status: "RECEIVED", attemptCount: 0, processingError: null },
      });
    }
  }

  const bookingEvents = await prisma.webhookEvent.findMany({
    where: {
      AND: [retryableWebhooks(), { eventType: { startsWith: "Booking" } }],
    },
    orderBy: {
      receivedAt: "asc",
    },
    take: 25,
    select: {
      id: true,
    },
  });
  const otherEvents = bookingEvents.length < 25
    ? await prisma.webhookEvent.findMany({
      where: {
        AND: [retryableWebhooks(), { eventType: { not: { startsWith: "Booking" } } }],
      },
      orderBy: { receivedAt: "asc" },
      take: 25 - bookingEvents.length,
      select: { id: true },
    })
    : [];
  const events = [...bookingEvents, ...otherEvents];

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await processWebhookEvent(event.id);
      processed++;
    } catch (error) {
      console.error(`Webhook processing failed for ${event.id}:`, error);
      failed++;
    }
  }

  const remaining = await prisma.webhookEvent.count({
    where: retryableWebhooks(),
  });

  return NextResponse.json({
    success: true,
    processed,
    failed,
    remaining,
    hasMore: remaining > 0,
  });
}
