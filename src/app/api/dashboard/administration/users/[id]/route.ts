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

function legacyRole(
  roleKeys: string[],
) {
  if (
    roleKeys.includes(
      "SUPER_ADMIN",
    ) ||
    roleKeys.includes("ADMIN")
  ) {
    return "ADMIN" as const;
  }

  if (
    roleKeys.includes(
      "OPERATIONS_MANAGER",
    )
  ) {
    return "MANAGER" as const;
  }

  return "OPERATOR" as const;
}

export async function PATCH(
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

  const target =
    await prisma.user.findUnique({
      where: {
        id: context.params.id,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        roleAssignments: {
          select: {
            role: {
              select: {
                id: true,
                key: true,
              },
            },
          },
        },
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

  const body =
    (await request.json().catch(
      () => ({}),
    )) as {
      name?: unknown;
      isActive?: unknown;
      roleIds?: unknown;
    };

  const nextName =
    typeof body.name === "string"
      ? body.name.trim()
      : undefined;

  const nextActive =
    typeof body.isActive ===
      "boolean"
      ? body.isActive
      : undefined;

  const requestedRoleIds =
    Array.isArray(body.roleIds)
      ? Array.from(
          new Set(
            body.roleIds.filter(
              (value): value is string =>
                typeof value ===
                  "string" &&
                value.length > 0,
            ),
          ),
        )
      : undefined;

  if (
    nextName !== undefined &&
    nextName.length < 2
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_NAME",
      },
      {
        status: 400,
      },
    );
  }

  if (
    requestedRoleIds !== undefined &&
    requestedRoleIds.length === 0
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "AT_LEAST_ONE_ROLE_REQUIRED",
      },
      {
        status: 400,
      },
    );
  }

  if (
    target.id === access.user.id &&
    nextActive === false
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "CANNOT_DEACTIVATE_SELF",
      },
      {
        status: 409,
      },
    );
  }

  const currentRoleKeys =
    target.roleAssignments.map(
      (assignment) =>
        assignment.role.key,
    );

  let roles:
    Array<{
      id: string;
      key: string;
    }> =
      target.roleAssignments.map(
        (assignment) => ({
          id: assignment.role.id,
          key: assignment.role.key,
        }),
      );

  if (
    requestedRoleIds !== undefined
  ) {
    roles =
      await prisma.administrationRole.findMany({
        where: {
          id: {
            in: requestedRoleIds,
          },
          isActive: true,
        },
        select: {
          id: true,
          key: true,
        },
      });

    if (
      roles.length !==
      requestedRoleIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_ROLE",
        },
        {
          status: 400,
        },
      );
    }
  }

  const nextRoleKeys =
    roles.map(
      (role) => role.key,
    );

  const superAdminChanging =
    currentRoleKeys.includes(
      "SUPER_ADMIN",
    ) !==
      nextRoleKeys.includes(
        "SUPER_ADMIN",
      );

  if (
    (
      superAdminChanging ||
      nextRoleKeys.includes(
        "SUPER_ADMIN",
      )
    ) &&
    !access.isSuperAdmin
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "SUPER_ADMIN_REQUIRED",
      },
      {
        status: 403,
      },
    );
  }

  const removesActiveSuperAdmin =
    target.isActive &&
    currentRoleKeys.includes(
      "SUPER_ADMIN",
    ) &&
    (
      nextActive === false ||
      !nextRoleKeys.includes(
        "SUPER_ADMIN",
      )
    );

  if (removesActiveSuperAdmin) {
    const activeSuperAdmins =
      await prisma.user.count({
        where: {
          isActive: true,
          roleAssignments: {
            some: {
              role: {
                key: "SUPER_ADMIN",
                isActive: true,
              },
            },
          },
        },
      });

    if (activeSuperAdmins <= 1) {
      return NextResponse.json(
        {
          success: false,
          error:
            "LAST_SUPER_ADMIN_PROTECTED",
          message:
            "The final active Super Administrator cannot be removed or deactivated.",
        },
        {
          status: 409,
        },
      );
    }
  }

  const roleIds =
    roles.map(
      (role) => role.id,
    );

  const changedFields: string[] = [];

  if (
    nextName !== undefined &&
    nextName !== target.name
  ) {
    changedFields.push("name");
  }

  if (
    nextActive !== undefined &&
    nextActive !== target.isActive
  ) {
    changedFields.push(
      "isActive",
    );
  }

  if (
    requestedRoleIds !== undefined
  ) {
    changedFields.push("roles");
  }

  const user =
    await prisma.$transaction(
      async (tx) => {
        if (
          requestedRoleIds !== undefined
        ) {
          await tx.administrationUserRole.deleteMany({
            where: {
              userId: target.id,
              roleId: {
                notIn: roleIds,
              },
            },
          });

          await tx.administrationUserRole.createMany({
            data:
              roles.map(
                (role) => ({
                  userId:
                    target.id,
                  roleId:
                    role.id,
                  assignedByUserId:
                    access.user.id,
                }),
              ),
            skipDuplicates: true,
          });
        }

        const updated =
          await tx.user.update({
            where: {
              id: target.id,
            },
            data: {
              name: nextName,
              isActive: nextActive,
              deactivatedAt:
                nextActive === false
                  ? new Date()
                  : nextActive === true
                    ? null
                    : undefined,
              role:
                requestedRoleIds !==
                  undefined
                  ? legacyRole(
                      nextRoleKeys,
                    )
                  : undefined,
            },
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              mustChangePassword:
                true,
              lastLoginAt: true,
              deactivatedAt: true,
              updatedAt: true,
              roleAssignments: {
                select: {
                  assignedAt: true,
                  role: {
                    select: {
                      id: true,
                      key: true,
                      name: true,
                    },
                  },
                },
              },
            },
          });

        await tx.administrationAuditEvent.create({
          data: {
            actorUserId:
              access.user.id,
            action: "USER_UPDATED",
            targetType: "USER",
            targetId: target.id,
            evidence: {
              changedFields,
              previousRoleKeys:
                currentRoleKeys,
              roleKeys:
                nextRoleKeys,
              active:
                updated.isActive,
              containsPassword:
                false,
            },
          },
        });

        return updated;
      },
    );

  return NextResponse.json({
    success: true,
    user,
  });
}
