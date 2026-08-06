import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import {
  AutocabRestError,
  getAutocabDrivers,
} from "@/lib/autocab/rest-client";
import { authOptions } from "@/lib/auth";
import {
  getStoredAutocabApiCredentials,
  recordAutocabConnectionResult,
} from "@/lib/integrations/autocab/configuration";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function normaliseBaseUrl(value: string) {
  const cleaned = value.trim().replace(/\/+$/, "");
  const url = new URL(cleaned);

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error(
      "Autocab base URL must use HTTP or HTTPS.",
    );
  }

  return url.toString().replace(/\/+$/, "");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

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
    !(await canManageIntegration(session.user.email))
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

  let usedStoredCredentials = false;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      baseUrl?: unknown;
      apiKey?: unknown;
    };

    let baseUrl: string;
    let apiKey: string;

    const suppliedBaseUrl =
      typeof body.baseUrl === "string"
        ? body.baseUrl.trim()
        : "";

    const suppliedApiKey =
      typeof body.apiKey === "string"
        ? body.apiKey.trim()
        : "";

    if (suppliedApiKey) {
      baseUrl = normaliseBaseUrl(
        suppliedBaseUrl ||
          "https://autocab-api.azure-api.net",
      );
      apiKey = suppliedApiKey;
    } else {
      const stored =
        await getStoredAutocabApiCredentials();

      baseUrl = normaliseBaseUrl(
        suppliedBaseUrl || stored.baseUrl,
      );
      apiKey = stored.apiKey;
      usedStoredCredentials = true;
    }

    const startedAt = Date.now();

    const drivers = await getAutocabDrivers({
      baseUrl,
      apiKey,
    });

    const responseTimeMs = Date.now() - startedAt;

    const activeDrivers = drivers.filter(
      (driver) => driver.active === true,
    ).length;

    const suspendedDrivers = drivers.filter(
      (driver) =>
        driver.suspended === true,
    ).length;

    if (usedStoredCredentials) {
      await recordAutocabConnectionResult(
        true,
      ).catch((error) => {
        console.error(
          "Could not record successful Autocab test:",
          error,
        );
      });
    }

    return NextResponse.json({
      success: true,
      message: "Autocab connection successful.",
      result: {
        endpoint: "/driver/v1/drivers",
        responseTimeMs,
        totalDrivers: drivers.length,
        activeDrivers,
        suspendedDrivers,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Autocab connection test failed.";

    if (usedStoredCredentials) {
      await recordAutocabConnectionResult(
        false,
        message,
      ).catch((recordError) => {
        console.error(
          "Could not record failed Autocab test:",
          recordError,
        );
      });
    }

    console.error(
      "Autocab connection test failed:",
      error,
    );

    const status =
      error instanceof AutocabRestError &&
      error.status === 401
        ? 401
        : error instanceof AutocabRestError &&
            error.status === 403
          ? 403
          : 502;

    return NextResponse.json(
      {
        success: false,
        error: "AUTOCAB_CONNECTION_TEST_FAILED",
        message,
        providerStatus:
          error instanceof AutocabRestError
            ? error.status
            : null,
      },
      {
        status,
      },
    );
  }
}
