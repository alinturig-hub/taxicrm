import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

    const credentials =
      await getAutocabApiCredentials();

    const configuredBase =
      new URL(credentials.baseUrl);

    const endpointUrl =
      new URL(body.url.trim());

    if (
      endpointUrl.protocol !== "https:" &&
      endpointUrl.protocol !== "http:"
    ) {
      throw new Error(
        "API URL must use HTTP or HTTPS.",
      );
    }

    if (
      endpointUrl.host !==
      configuredBase.host
    ) {
      throw new Error(
        "This endpoint does not belong to the configured Autocab API host.",
      );
    }

    const startedAt = Date.now();

    const response = await fetch(
      endpointUrl.toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key":
            credentials.apiKey,
        },
        cache: "no-store",
      },
    );

    const responseTimeMs =
      Date.now() - startedAt;

    const text =
      await response.text();

    let parsed: unknown = null;

    try {
      parsed = text
        ? JSON.parse(text)
        : null;
    } catch {
      parsed = {
        raw: text.slice(0, 5000),
      };
    }

    if (!response.ok) {
      throw new Error(
        `Autocab API returned HTTP ${response.status}.`,
      );
    }

    const endpoint =
      await prisma.apiEndpointConfiguration.upsert({
        where: {
          url: endpointUrl.toString(),
        },
        create: {
          provider: "AUTOCAB",
          name: deriveName(endpointUrl),
          method: "GET",
          url: endpointUrl.toString(),
          path: endpointUrl.pathname,
          isEnabled: true,
          lastTestedAt: new Date(),
          lastStatusCode:
            response.status,
          lastResponseTimeMs:
            responseTimeMs,
          lastError: null,
          sampleResponse:
            parsed as object,
        },
        update: {
          provider: "AUTOCAB",
          name: deriveName(endpointUrl),
          method: "GET",
          path: endpointUrl.pathname,
          isEnabled: true,
          lastTestedAt: new Date(),
          lastStatusCode:
            response.status,
          lastResponseTimeMs:
            responseTimeMs,
          lastError: null,
          sampleResponse:
            parsed as object,
        },
      });

    return NextResponse.json({
      success: true,
      endpoint,
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
        status: 500,
      },
    );
  }
}
