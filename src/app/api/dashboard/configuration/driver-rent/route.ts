import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const GLOBAL_KEY = "GLOBAL";

async function canManageDriverRent(
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

function serializeConfiguration(
  configuration: {
    rentPercentage: unknown;
    weeklyCap: unknown;
    updatedAt: Date;
  },
) {
  const rentPercentage = Number(
    configuration.rentPercentage,
  );
  const weeklyCap = Number(
    configuration.weeklyCap,
  );

  return {
    rentPercentage,
    weeklyCap,
    fullRentThreshold:
      rentPercentage > 0
        ? Number(
            (
              weeklyCap /
              (rentPercentage / 100)
            ).toFixed(2),
          )
        : 0,
    updatedAt: configuration.updatedAt,
  };
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
      await prisma.driverRentConfiguration.upsert({
        where: {
          key: GLOBAL_KEY,
        },
        create: {
          key: GLOBAL_KEY,
          rentPercentage: 20,
          weeklyCap: 160,
        },
        update: {},
      });

    return NextResponse.json({
      success: true,
      configuration:
        serializeConfiguration(configuration),
    });
  } catch (error) {
    console.error(
      "Failed to load driver rent configuration:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "DRIVER_RENT_CONFIGURATION_LOAD_FAILED",
        message:
          "Driver rent configuration could not be loaded.",
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
    !(await canManageDriverRent(
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
    const body = (await request.json()) as {
      rentPercentage?: unknown;
      weeklyCap?: unknown;
    };

    const rentPercentage = Number(
      body.rentPercentage,
    );
    const weeklyCap = Number(body.weeklyCap);

    if (
      !Number.isFinite(rentPercentage) ||
      rentPercentage <= 0 ||
      rentPercentage > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_RENT_PERCENTAGE",
          message:
            "Rent percentage must be greater than 0 and no more than 100.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !Number.isFinite(weeklyCap) ||
      weeklyCap <= 0 ||
      weeklyCap > 10000
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_WEEKLY_CAP",
          message:
            "Weekly cap must be greater than 0.",
        },
        {
          status: 400,
        },
      );
    }

    const configuration =
      await prisma.driverRentConfiguration.upsert({
        where: {
          key: GLOBAL_KEY,
        },
        create: {
          key: GLOBAL_KEY,
          rentPercentage,
          weeklyCap,
        },
        update: {
          rentPercentage,
          weeklyCap,
        },
      });

    return NextResponse.json({
      success: true,
      configuration:
        serializeConfiguration(configuration),
    });
  } catch (error) {
    console.error(
      "Failed to save driver rent configuration:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "DRIVER_RENT_CONFIGURATION_SAVE_FAILED",
        message:
          "Driver rent configuration could not be saved.",
      },
      {
        status: 500,
      },
    );
  }
}
