import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ADMINISTRATION_PERMISSIONS,
  requireAdministrationPermission,
} from "@/lib/administration-access";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: NextRequest,
  context: {
    params: {
      id: string;
    };
  },
) {
  const session =
    await getServerSession(authOptions);

  const access =
    await requireAdministrationPermission(
      session?.user?.email,
      ADMINISTRATION_PERMISSIONS
        .USERS_MANAGE,
    );

  if (!access) {
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

  const body =
    (await request.json().catch(
      () => ({}),
    )) as {
      temporaryPassword?: unknown;
    };

  const temporaryPassword =
    typeof body.temporaryPassword ===
      "string"
      ? body.temporaryPassword
      : "";

  if (
    temporaryPassword.length < 12
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "PASSWORD_TOO_SHORT",
        message:
          "The temporary password must contain at least 12 characters.",
      },
      {
        status: 400,
      },
    );
  }

  const target =
    await prisma.user.findUnique({
      where: {
        id: context.params.id,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

  if (!target) {
    return NextResponse.json(
      {
        success: false,
        error: "USER_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  const passwordHash =
    await hash(
      temporaryPassword,
      12,
    );

  await prisma.$transaction(
    async (tx) => {
      await tx.user.update({
        where: {
          id: target.id,
        },
        data: {
          passwordHash,
          mustChangePassword:
            true,
          passwordChangedAt:
            new Date(),
        },
      });

      await tx.administrationAuditEvent.create({
        data: {
          actorUserId:
            access.user.id,
          action:
            "USER_PASSWORD_RESET",
          targetType: "USER",
          targetId: target.id,
          evidence: {
            temporaryPassword:
              true,
            passwordLengthCompliant:
              true,
            containsPassword:
              false,
            targetActive:
              target.isActive,
          },
        },
      });
    },
  );

  return NextResponse.json({
    success: true,
    mustChangePassword: true,
    containsPassword: false,
  });
}
