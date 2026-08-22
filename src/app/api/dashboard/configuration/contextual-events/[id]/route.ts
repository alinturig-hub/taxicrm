import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function authorise() {
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

  return null;
}

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: {
      id: string;
    };
  },
) {
  const denied = await authorise();

  if (denied) {
    return denied;
  }

  try {
    const body = (await request.json()) as {
      active?: unknown;
    };

    if (typeof body.active !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_ACTIVE_STATE",
          message:
            "Active state must be true or false.",
        },
        {
          status: 400,
        },
      );
    }

    const event =
      await prisma.contextualCalendarEvent.update({
        where: {
          id: params.id,
        },
        data: {
          active: body.active,
        },
      });

    return NextResponse.json({
      success: true,
      event,
      message: body.active
        ? "Event activated."
        : "Event deactivated.",
    });
  } catch (error) {
    console.error(
      "Contextual event update failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "EVENT_UPDATE_FAILED",
        message:
          "Event could not be updated.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: {
      id: string;
    };
  },
) {
  const denied = await authorise();

  if (denied) {
    return denied;
  }

  try {
    await prisma.contextualCalendarEvent.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Event deleted.",
    });
  } catch (error) {
    console.error(
      "Contextual event deletion failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "EVENT_DELETE_FAILED",
        message:
          "Event could not be deleted.",
      },
      {
        status: 500,
      },
    );
  }
}
