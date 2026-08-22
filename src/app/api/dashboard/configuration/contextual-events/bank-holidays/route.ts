import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import {
  saveContextualEvents,
  validateEvent,
} from "@/lib/contextual-events/import-events";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BankHolidayResponse = {
  "england-and-wales"?: {
    division?: string;
    events?: Array<{
      title?: string;
      date?: string;
      notes?: string;
    }>;
  };
};

async function canManage(
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

function nextCalendarDate(value: string) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(
      `Invalid bank holiday date: ${value}`,
    );
  }

  const next = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) + 1,
    ),
  );

  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(
      2,
      "0",
    ),
    String(next.getUTCDate()).padStart(
      2,
      "0",
    ),
  ].join("-");
}

export async function POST() {
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
    !(await canManage(session.user.email))
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
    const response = await fetch(
      "https://www.gov.uk/bank-holidays.json",
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `GOV.UK returned ${response.status}.`,
      );
    }

    const payload =
      (await response.json()) as BankHolidayResponse;

    const holidays =
      payload["england-and-wales"]?.events ??
      [];

    const events = holidays
      .filter(
        (
          holiday,
        ): holiday is {
          title: string;
          date: string;
          notes?: string;
        } =>
          Boolean(
            holiday.title &&
              holiday.date,
          ),
      )
      .map((holiday) =>
        validateEvent({
          externalId:
            `${holiday.date}:${holiday.title}`,
          title: holiday.title,
          category: "PUBLIC_HOLIDAY",
          startsAt: `${holiday.date} 00:00`,
          endsAt:
            `${nextCalendarDate(holiday.date)} 00:00`,
          locationName:
            "England and Wales",
          description:
            holiday.notes?.trim() ||
            "Official public holiday.",
          impactLevel: "HIGH",
          sourceUrl:
            "https://www.gov.uk/bank-holidays",
          active: true,
        }),
      );

    const result =
      await saveContextualEvents(
        events,
        "GOV_UK",
      );

    return NextResponse.json({
      success: true,
      message:
        `${result.saved} official bank holidays synchronised.`,
      ...result,
    });
  } catch (error) {
    console.error(
      "Bank holiday synchronisation failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "BANK_HOLIDAY_SYNC_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Bank holidays could not be synchronised.",
      },
      {
        status: 500,
      },
    );
  }
}
