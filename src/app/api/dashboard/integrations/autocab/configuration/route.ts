import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPublicAutocabConfiguration,
  saveAutocabConfiguration,
} from "@/lib/integrations/autocab/configuration";

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

export async function GET() {
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

  try {
    const configuration =
      await getPublicAutocabConfiguration();

    return NextResponse.json({
      success: true,
      configuration,
    });
  } catch (error) {
    console.error(
      "Failed to load Autocab API configuration:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "AUTOCAB_CONFIGURATION_LOAD_FAILED",
        message:
          "Autocab configuration could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(request: Request) {
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

  try {
    const body = (await request.json()) as {
      baseUrl?: unknown;
      apiKey?: unknown;
      isEnabled?: unknown;
    };

    if (
      typeof body.baseUrl !== "string" ||
      body.baseUrl.trim().length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_BASE_URL",
          message: "Base URL is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (typeof body.isEnabled !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_ENABLED_STATE",
          message:
            "Enabled state must be true or false.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      body.apiKey !== undefined &&
      typeof body.apiKey !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_API_KEY",
          message: "API key must be a string.",
        },
        {
          status: 400,
        },
      );
    }

    const configuration =
      await saveAutocabConfiguration({
        baseUrl: body.baseUrl,
        apiKey:
          typeof body.apiKey === "string"
            ? body.apiKey
            : undefined,
        isEnabled: body.isEnabled,
      });

    return NextResponse.json({
      success: true,
      configuration,
    });
  } catch (error) {
    console.error(
      "Failed to save Autocab API configuration:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Autocab configuration could not be saved.";

    return NextResponse.json(
      {
        success: false,
        error: "AUTOCAB_CONFIGURATION_SAVE_FAILED",
        message,
      },
      {
        status: 500,
      },
    );
  }
}
