import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { processWebhookEvent } from "@/lib/autocab/process-webhook-event";

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

function createIdempotencyKey(
  eventSlug: string,
  rawBody: string,
): string {
  const payloadHash = createHash("sha256")
    .update(rawBody)
    .digest("hex");

  return `AUTOCAB:${eventSlug}:${payloadHash}`;
}

function secureCompare(
  provided: string,
  expected: string,
): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function getApiKeyHeaderName(): string {
  return (
    process.env.AUTOCAB_WEBHOOK_API_KEY_HEADER
      ?.trim()
      .toLowerCase() || "x-autocab-api-key"
  );
}

function validateApiKey(request: NextRequest): boolean {
  const expectedApiKey =
    process.env.AUTOCAB_WEBHOOK_API_KEY;

  if (!expectedApiKey) {
    return true;
  }

  const providedApiKey = request.headers.get(
    getApiKeyHeaderName(),
  );

  if (!providedApiKey) {
    return false;
  }

  return secureCompare(providedApiKey, expectedApiKey);
}

function headersToJson(
  request: NextRequest,
): Prisma.InputJsonObject {
  const headers: Record<string, string> = {};
  const apiKeyHeaderName = getApiKeyHeaderName();

  request.headers.forEach((value, key) => {
    const normalisedKey = key.toLowerCase();

    if (
      normalisedKey === "authorization" ||
      normalisedKey === "cookie" ||
      normalisedKey === apiKeyHeaderName
    ) {
      return;
    }

    headers[normalisedKey] = value;
  });

  return headers;
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const eventSlug = normaliseEventSlug(
    context.params.event,
  );

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
      throw new Error(
        "The webhook payload must be a JSON object.",
      );
    }

    payload = parsedPayload as AutocabPayload;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_JSON",
        message:
          "The received payload is not a valid JSON object.",
      },
      {
        status: 400,
      },
    );
  }

  const eventType =
    getPayloadString(payload, [
      "EventType",
      "eventType",
      "EventName",
      "eventName",
      "Type",
      "type",
    ]) ?? eventSlug;

  const externalBookingId = getPayloadString(payload, [
    "Id",
    "BookingId",
    "OriginalBookingId",
    "bookingId",
    "originalBookingId",
    "id",
  ]);

  const idempotencyKey = createIdempotencyKey(
    eventSlug,
    rawBody,
  );

  try {
    const webhookEvent =
      await prisma.webhookEvent.create({
        data: {
          provider: "AUTOCAB",
          eventType,
          externalBookingId,
          idempotencyKey,
          status: "RECEIVED",
          payload: payload as Prisma.InputJsonObject,
          headers: headersToJson(request),
        },
        select: {
          id: true,
          provider: true,
          eventType: true,
          externalBookingId: true,
          status: true,
          receivedAt: true,
        },
      });

    void processWebhookEvent(webhookEvent.id).catch((error) => {
      console.error(
        `Background processing failed for webhook ${webhookEvent.id}:`,
        error,
      );
    });


    return NextResponse.json(
      {
        success: true,
        duplicate: false,
        event: eventSlug,
        message:
          "The raw Autocab event has been stored successfully.",
        webhook: webhookEvent,
      },
      {
        status: 202,
      },
    );
  } catch (error) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingWebhook =
        await prisma.webhookEvent.findUnique({
          where: {
            idempotencyKey,
          },
          select: {
            id: true,
            provider: true,
            eventType: true,
            externalBookingId: true,
            status: true,
            receivedAt: true,
          },
        });

      return NextResponse.json(
        {
          success: true,
          duplicate: true,
          event: eventSlug,
          message:
            "This exact Autocab event has already been stored.",
          webhook: existingWebhook,
        },
        {
          status: 200,
        },
      );
    }

    console.error(
      "Autocab raw webhook storage failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "WEBHOOK_STORAGE_FAILED",
        message:
          "The raw Autocab event could not be stored.",
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
  const eventSlug = normaliseEventSlug(
    context.params.event,
  );

  return NextResponse.json({
    success: true,
    provider: "AUTOCAB",
    event: eventSlug,
    endpoint: `/api/webhooks/autocab/${eventSlug}`,
    method: "POST",
    storageMode: "RAW_EVENT_ONLY",
  });
}
