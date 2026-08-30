import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user?.email) {
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

  const body =
    (await request.json().catch(
      () => ({}),
    )) as {
      newPassword?: unknown;
      confirmation?: unknown;
    };

  const newPassword =
    typeof body.newPassword ===
      "string"
      ? body.newPassword
      : "";

  const confirmation =
    typeof body.confirmation ===
      "string"
      ? body.confirmation
      : "";

  if (
    newPassword.length < 12 ||
    newPassword !== confirmation
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_PASSWORD",
        message:
          "Passwords must match and contain at least 12 characters.",
      },
      {
        status: 400,
      },
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email:
          session.user.email
            .trim()
            .toLowerCase(),
      },
      select: {
        id: true,
        isActive: true,
      },
    });

  if (!user?.isActive) {
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

  const passwordHash =
    await hash(
      newPassword,
      12,
    );

  await prisma.$transaction(
    async (tx) => {
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,
          mustChangePassword:
            false,
          passwordChangedAt:
            new Date(),
        },
      });

      await tx.administrationAuditEvent.create({
        data: {
          actorUserId: user.id,
          action:
            "USER_PASSWORD_CHANGED",
          targetType: "USER",
          targetId: user.id,
          evidence: {
            selfService: true,
            containsPassword:
              false,
          },
        },
      });
    },
  );

  return NextResponse.json({
    success: true,
    requiresSignIn: true,
    containsPassword: false,
  });
}
