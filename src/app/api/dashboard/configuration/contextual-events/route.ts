import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  parseEventCsv,
  saveContextualEvents,
  validateEvent,
} from "@/lib/contextual-events/import-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_CSV_SIZE = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

async function canManageEvents(
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
      (
        user.role === "ADMIN" ||
        user.role === "MANAGER"
      ),
  );
}

async function authorise(
  requireManager = false,
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
        },
        {
          status: 401,
        },
      ),
    };
  }

  if (
    requireManager &&
    !(await canManageEvents(
      session.user.email,
    ))
  ) {
    return {
      response: NextResponse.json(
        {
          success: false,
          error: "FORBIDDEN",
        },
        {
          status: 403,
        },
      ),
    };
  }

  return {
    response: null,
  };
}

export async function GET(request: Request) {
  const access = await authorise();

  if (access.response) {
    return access.response;
  }

  try {
    const url = new URL(request.url);
    const query =
      url.searchParams.get("q")?.trim() ?? "";
    const category =
      url.searchParams.get("category")?.trim() ??
      "";
    const activeValue =
      url.searchParams.get("active");

    const events =
      await prisma.contextualCalendarEvent.findMany({
        where: {
          ...(query
            ? {
                OR: [
                  {
                    title: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                  {
                    locationName: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                  {
                    description: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
          ...(category
            ? {
                category,
              }
            : {}),
          ...(activeValue === "true" ||
          activeValue === "false"
            ? {
                active:
                  activeValue === "true",
              }
            : {}),
        },
        orderBy: [
          {
            startsAt: "asc",
          },
          {
            title: "asc",
          },
        ],
        take: 1000,
      });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error(
      "Contextual events could not be loaded:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "EVENTS_LOAD_FAILED",
        message:
          "City events could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  const access = await authorise(true);

  if (access.response) {
    return access.response;
  }

  try {
    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      contentType.includes(
        "multipart/form-data",
      )
    ) {
      const form = await request.formData();
      const uploaded = form.get("file");

      if (!(uploaded instanceof File)) {
        return NextResponse.json(
          {
            success: false,
            error: "CSV_FILE_REQUIRED",
            message:
              "Please select a CSV file.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        uploaded.size <= 0 ||
        uploaded.size > MAX_CSV_SIZE
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "INVALID_CSV_SIZE",
            message:
              "CSV must be no larger than 2 MB.",
          },
          {
            status: 400,
          },
        );
      }

      const parsed = parseEventCsv(
        await uploaded.text(),
      );

      if (
        parsed.totalRows > MAX_IMPORT_ROWS
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "TOO_MANY_ROWS",
            message:
              "A maximum of 5,000 events can be imported at once.",
          },
          {
            status: 400,
          },
        );
      }

      if (parsed.errors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "CSV_VALIDATION_FAILED",
            message:
              "No events were saved because some CSV rows are invalid.",
            totalRows: parsed.totalRows,
            validRows: parsed.events.length,
            errors: parsed.errors.slice(0, 100),
          },
          {
            status: 400,
          },
        );
      }

      const result =
        await saveContextualEvents(
          parsed.events,
          "MANUAL_CSV",
        );

      return NextResponse.json({
        success: true,
        message:
          `${result.saved} city events imported successfully.`,
        totalRows: parsed.totalRows,
        ...result,
      });
    }

    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    const event = validateEvent(body);
    const result =
      await saveContextualEvents(
        [event],
        "MANUAL",
      );

    return NextResponse.json({
      success: true,
      message:
        "City event saved successfully.",
      ...result,
    });
  } catch (error) {
    console.error(
      "Contextual event save failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "EVENT_SAVE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "City event could not be saved.",
      },
      {
        status: 400,
      },
    );
  }
}
