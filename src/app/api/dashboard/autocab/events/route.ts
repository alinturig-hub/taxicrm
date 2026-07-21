import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function calculatePayloadSize(payload: unknown): number {
  try {
    return Buffer.byteLength(
      JSON.stringify(payload),
      "utf8",
    );
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const events = await prisma.webhookEvent.findMany({
      orderBy: {
        receivedAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        provider: true,
        eventType: true,
        externalBookingId: true,
        idempotencyKey: true,
        status: true,
        payload: true,
        processingError: true,
        attemptCount: true,
        receivedAt: true,
        processedAt: true,
        updatedAt: true,
        bookingId: true,
        webhookConfigurationId: true,
      },
    });

    return NextResponse.json({
      success: true,
      total: events.length,
      events: events.map((event) => ({
        id: event.id,
        provider: event.provider,
        eventType: event.eventType,
        externalBookingId: event.externalBookingId,
        bookingId: event.bookingId,
        webhookConfigurationId:
          event.webhookConfigurationId,
        idempotencyKey: event.idempotencyKey,
        status: event.status,
        payloadSize: calculatePayloadSize(
          event.payload,
        ),
        processingError: event.processingError,
        attemptCount: event.attemptCount,
        receivedAt: event.receivedAt,
        processedAt: event.processedAt,
        updatedAt: event.updatedAt,
      })),
    });
  } catch (error) {
    console.error(
      "Autocab webhook inbox retrieval failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "WEBHOOK_EVENTS_RETRIEVAL_FAILED",
        message:
          "Webhook events could not be retrieved.",
      },
      {
        status: 500,
      },
    );
  }
}
