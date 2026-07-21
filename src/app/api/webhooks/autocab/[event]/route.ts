import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { processBookingCreatedWebhook } from "@/lib/autocab/process-booking-created";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    event: string;
  };
};

type AutocabPayload = Record<string, unknown>;

function normaliseEventSlug(value: string): string {
  return decodeURIComponent(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normaliseEventName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getPayloadString(
  payload: AutocabPayload,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }

    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
  }

  return null;
}

function createIdempotencyKey(eventSlug: string, rawBody: string): string {
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  return `AUTOCAB:${eventSlug}:${payloadHash}`;
}

function secureCompare(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function validateApiKey(request: NextRequest): boolean {
  const expectedApiKey = process.env.AUTOCAB_WEBHOOK_API_KEY;

  if (!expectedApiKey) {
    return true;
  }

  const headerName =
    process.env.AUTOCAB_WEBHOOK_API_KEY_HEADER?.trim().toLowerCase() ||
    "x-autocab-api-key";

  const providedApiKey = request.headers.get(headerName);

  if (!providedApiKey) {
    return false;
  }

  return secureCompare(providedApiKey, expectedApiKey);
}

function headersToJson(request: NextRequest): Prisma.InputJsonObject {
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    const normalisedKey = key.toLowerCase();

    if (normalisedKey !== "authorization" && normalisedKey !== "cookie") {
      headers[key] = value;
    }
  });

  return headers;
}

async function processStoredWebhook(
  webhookEventId: string,
  eventType: string,
): Promise<void> {
  const normalisedEventType = normaliseEventName(eventType);

  switch (normalisedEventType) {
    case "bookingcreated":
      await processBookingCreatedWebhook(webhookEventId);
      return;

    default:
      return;
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const eventSlug = normaliseEventSlug(context.params.event);

  if (!eventSlug) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_EVENT",
        message: "The event suffix is invalid.",
      },
      {
        status: 400,
      },
    );
  }

  if (!validateApiKey(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
        message: "The webhook API key is invalid.",
      },
      {
        status: 401,
      },
    );
  }

  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "EMPTY_PAYLOAD",
        message: "The webhook does not contain a payload.",
      },
      {
        status: 400,
      },
    );
  }

  let payload: AutocabPayload;

  try {
    const parsedPayload: unknown = JSON.parse(rawBody);

    if (
      typeof parsedPayload !== "object" ||
      parsedPayload === null ||
      Array.isArray(parsedPayload)
    ) {
      throw new Error("The payload must be a JSON object.");
    }

    payload = parsedPayload as AutocabPayload;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_JSON",
        message: "The received payload is not valid JSON.",
      },
      {
        status: 400,
      },
    );
  }

  const payloadEventType =
    getPayloadString(payload, ["EventType", "eventType"]) ?? eventSlug;

  const externalBookingId = getPayloadString(payload, [
    "Id",
    "BookingId",
    "OriginalBookingId",
    "bookingId",
    "id",
  ]);

  const idempotencyKey = createIdempotencyKey(eventSlug, rawBody);

  try {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        provider: "AUTOCAB",
        eventType: payloadEventType,
        externalBookingId,
        idempotencyKey,
        status: "RECEIVED",
        payload: payload as Prisma.InputJsonObject,
        headers: headersToJson(request),
      },
      select: {
        id: true,
        eventType: true,
        externalBookingId: true,
        status: true,
        receivedAt: true,
      },
    });

    try {
      await processStoredWebhook(webhookEvent.id, payloadEventType);
    } catch (processingError) {
      console.error(
        `Autocab webhook processing failed for ${webhookEvent.id}:`,
        processingError,
      );
    }

    const processedWebhook = await prisma.webhookEvent.findUnique({
      where: {
        id: webhookEvent.id,
      },
      select: {
        id: true,
        eventType: true,
        externalBookingId: true,
        status: true,
        processingError: true,
        receivedAt: true,
        processedAt: true,
        bookingId: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        duplicate: false,
        event: eventSlug,
        webhook: processedWebhook ?? webhookEvent,
      },
      {
        status: 202,
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingWebhook = await prisma.webhookEvent.findUnique({
        where: {
          idempotencyKey,
        },
        select: {
          id: true,
          eventType: true,
          externalBookingId: true,
          status: true,
          processingError: true,
          receivedAt: true,
          processedAt: true,
          bookingId: true,
        },
      });

      return NextResponse.json(
        {
          success: true,
          duplicate: true,
          event: eventSlug,
          message: "The event has already been received.",
          webhook: existingWebhook,
        },
        {
          status: 200,
        },
      );
    }

    console.error("Autocab webhook reception failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "WEBHOOK_STORAGE_FAILED",
        message: "The event could not be stored.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const eventSlug = normaliseEventSlug(context.params.event);

  return NextResponse.json({
    success: true,
    provider: "AUTOCAB",
    event: eventSlug,
    endpoint: `/api/webhooks/autocab/${eventSlug}`,
    method: "POST",
  });
}
