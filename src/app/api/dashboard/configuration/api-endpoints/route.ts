import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeApiResponse, apiRecords, ApiRecordError } from "@/lib/integrations/autocab/generic-api-sync/store";
import { signApiPreview, verifyApiPreview, ApiPreviewError } from "@/lib/integrations/autocab/generic-api-sync/preview";
import { Prisma } from "@/generated/prisma/client";
import { getAutocabApiCredentials } from "@/lib/integrations/autocab/configuration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function canManageIntegration(
  email: string | null | undefined,
) {
  if (!email) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
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

function deriveName(url: URL) {
  const parts = url.pathname
    .split("/")
    .filter(Boolean);

  const value =
    parts.at(-1) ?? "API Endpoint";

  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

export async function GET() {
  const session =
    await getServerSession(authOptions);

  if (!session?.user) {
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

  const endpoints =
    await prisma.apiEndpointConfiguration.findMany({
      where: {provider:"AUTOCAB"},
      orderBy: {
        createdAt: "desc",
      },
    });

  return NextResponse.json({
    success: true,
    endpoints,
  });
}

export async function POST(
  request: Request,
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user) {
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
      {
        status: 403,
      },
    );
  }

  try {
    const body =
      (await request.json()) as {
        url?: unknown;
        jsonSchema?: unknown;
        exampleResponse?: unknown;
        recordKey?: unknown;
        storeRecords?: unknown;
        parameters?: Record<string, unknown>;
        previewOnly?: unknown;
        previewData?: unknown;
        previewToken?: unknown;
        previewStatusCode?: unknown;
        previewResponseTimeMs?: unknown;
      };

    if (
      typeof body.url !== "string" ||
      body.url.trim().length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_URL",
          message:
            "API URL is required.",
        },
        {
          status: 400,
        },
      );
    }

    const configuredUrl = body.url.trim();
    let resolvedUrl = configuredUrl;

    const placeholders: string[] = [];
    const placeholderPattern = /\{([^}]+)\}/g;
    let placeholderMatch: RegExpExecArray | null;

    while (
      (placeholderMatch =
        placeholderPattern.exec(resolvedUrl)) !== null
    ) {
      placeholders.push(placeholderMatch[1]);
    }

    for (const parameterName of placeholders) {
      const value = body.parameters?.[parameterName];

      if (
        typeof value !== "string" ||
        value.trim().length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "PARAMETER_REQUIRED",
            message: `Parameter "${parameterName}" is required to test this API.`,
          },
          {
            status: 400,
          },
        );
      }

      resolvedUrl = resolvedUrl.replaceAll(
        `{${parameterName}}`,
        encodeURIComponent(value.trim()),
      );
    }

    const endpointUrl = new URL(resolvedUrl);
    if (!["https:", "http:"].includes(endpointUrl.protocol)) throw new Error("API URL must use HTTP or HTTPS.");
    const recordKey =
      typeof body.recordKey === "string" &&
      body.recordKey.trim().length > 0
        ? body.recordKey.trim()
        : null;

    const storeRecords =
      body.storeRecords !== false;

    let parsed: unknown;
    let statusCode = 200, responseTimeMs = 0;
    if (body.previewOnly !== true) {
      if (typeof body.previewToken !== "string" || !Object.hasOwn(body, "previewData")) throw new ApiPreviewError("Preview this API before saving.");
      verifyApiPreview(endpointUrl.toString(), [body.previewData, body.previewStatusCode, body.previewResponseTimeMs], body.previewToken);
      if (typeof body.previewStatusCode !== "number" || typeof body.previewResponseTimeMs !== "number") throw new ApiPreviewError("Invalid preview metadata.");
      statusCode = body.previewStatusCode; responseTimeMs = body.previewResponseTimeMs;
      parsed = body.previewData;
    } else {
      const credentials = await getAutocabApiCredentials();
      if (endpointUrl.origin !== new URL(credentials.baseUrl).origin) throw new Error("This endpoint does not belong to the configured Autocab API host.");
      const startedAt = Date.now();
      const response = await fetch(endpointUrl, { method: "GET", redirect: "error",
        headers: { Accept: "application/json", "Ocp-Apim-Subscription-Key": credentials.apiKey },
        cache: "no-store", signal: AbortSignal.timeout(60000) });
      statusCode = response.status;
      if (!response.ok) throw new Error(`Autocab API returned HTTP ${response.status}.`);
      parsed = await response.json();
      responseTimeMs = Date.now() - startedAt;
    }

    const responseType =
      Array.isArray(parsed)
        ? "array"
        : parsed !== null &&
            typeof parsed === "object"
          ? "object"
          : typeof parsed;

    if (body.previewOnly === true) {
      return NextResponse.json({
        success: true,
        preview: {
          statusCode,
          responseTimeMs,
          responseType,
          data: parsed,
          token: signApiPreview(endpointUrl.toString(), [parsed, statusCode, responseTimeMs]),
        },
      });
    }

    if (storeRecords) apiRecords(parsed, recordKey);
    const saved = await prisma.$transaction(async (tx) => {
    const previous = await tx.apiEndpointConfiguration.findUnique({where: {url: configuredUrl}, select: {id: true}});
    if (previous) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`api-records:${previous.id}`}, 0))::text`;
    const endpoint =
      await tx.apiEndpointConfiguration.upsert({
        where: {
          url: configuredUrl,
        },
        create: {
          provider: "AUTOCAB",
          name: deriveName(endpointUrl),
          method: "GET",
          url: configuredUrl,
          path: endpointUrl.pathname,
          isEnabled: true,
          responseType,
          recordKey,
          jsonSchema:
            body.jsonSchema &&
            typeof body.jsonSchema === "object"
              ? (body.jsonSchema as object)
              : undefined,
          exampleResponse:
            body.exampleResponse !== undefined
              ? (body.exampleResponse as object)
              : undefined,
          storeRecords,
          lastTestedAt: new Date(),
          lastStatusCode:
            statusCode,
          lastResponseTimeMs:
            responseTimeMs,
          lastError: null,
          sampleResponse:
            parsed === null ? Prisma.JsonNull : parsed as Prisma.InputJsonValue,
        },
        update: {
          provider: "AUTOCAB",
          name: deriveName(endpointUrl),
          method: "GET",
          path: endpointUrl.pathname,
          isEnabled: true,
          responseType,
          recordKey,
          jsonSchema:
            body.jsonSchema &&
            typeof body.jsonSchema === "object"
              ? (body.jsonSchema as object)
              : undefined,
          exampleResponse:
            body.exampleResponse !== undefined
              ? (body.exampleResponse as object)
              : undefined,
          storeRecords,
          lastTestedAt: new Date(),
          lastStatusCode:
            statusCode,
          lastResponseTimeMs:
            responseTimeMs,
          lastError: null,
          sampleResponse:
            parsed === null ? Prisma.JsonNull : parsed as Prisma.InputJsonValue,
        },
      });

    const stored = storeRecords ? await storeApiResponse(endpoint.id, parsed, recordKey, tx) : null;
    return {endpoint, stored};
    }, {timeout: 60000});
    return NextResponse.json({
      success: true,
      endpoint: saved.endpoint,
      stored: saved.stored,
    });
  } catch (error) {
    console.error(
      "API endpoint configuration failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "API_ENDPOINT_CONFIGURATION_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "API endpoint could not be configured.",
      },
      {
        status: error instanceof ApiPreviewError || error instanceof ApiRecordError ? 400 : 500,
      },
    );
  }
}
