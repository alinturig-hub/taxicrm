import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

function calculateJsonSize(value: unknown): number {
  try {
    return Buffer.byteLength(
      JSON.stringify(value),
      "utf8",
    );
  } catch {
    return 0;
  }
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const eventId = context.params.id.trim();

  if (!eventId) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_EVENT_ID",
        message: "The webhook event ID is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const event = await prisma.webhookEvent.findUnique({
      where: {
        id: eventId,
      },
      select: {
        id: true,
        provider: true,
        eventType: true,
        externalBookingId: true,
        idempotencyKey: true,
        status: true,
        payload: true,
        headers: true,
        processingError: true,
        attemptCount: true,
        receivedAt: true,
        processedAt: true,
        updatedAt: true,
        bookingId: true,
        webhookConfigurationId: true,
        webhookConfiguration: {
          select: {
            id: true,
            displayName: true,
            eventType: true,
            endpointSlug: true,
            description: true,
            isEnabled: true,
          },
        },
        timelineEvents: {
          orderBy: {
            occurredAt: "asc",
          },
          select: {
            id: true,
            eventType: true,
            title: true,
            description: true,
            source: true,
            createdBy: true,
            metadata: true,
            occurredAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error: "WEBHOOK_EVENT_NOT_FOUND",
          message: "The webhook event could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        provider: event.provider,
        eventType: event.eventType,
        externalBookingId: event.externalBookingId,
        bookingId: event.bookingId,
        webhookConfigurationId:
          event.webhookConfigurationId,
        idempotencyKey: event.idempotencyKey,
        status: event.status,
        payload: event.payload,
        payloadSize: calculateJsonSize(event.payload),
        headers: event.headers,
        headersSize: calculateJsonSize(event.headers),
        processingError: event.processingError,
        attemptCount: event.attemptCount,
        receivedAt: event.receivedAt,
        processedAt: event.processedAt,
        updatedAt: event.updatedAt,
        webhookConfiguration:
          event.webhookConfiguration,
        timelineEvents: event.timelineEvents,
      },
    });
  } catch (error) {
    console.error(
      `Autocab webhook event retrieval failed for ${eventId}:`,
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "WEBHOOK_EVENT_RETRIEVAL_FAILED",
        message:
          "The webhook event details could not be retrieved.",
      },
      {
        status: 500,
      },
    );
  }
}
