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
        .ROLES_MANAGE,
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

  const current =
    await prisma.administrationRole.findUnique({
      where: {
        id: context.params.id,
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        _count: {
          select: {
            users: true,
          },
        },
        permissions: {
          select: {
            permission: {
              select: {
                id: true,
                key: true,
              },
            },
          },
        },
      },
    });

  if (!current) {
    return NextResponse.json(
      {
        success: false,
        error: "ROLE_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  if (
    current.isSystem &&
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

  const body =
    (await request.json().catch(
      () => ({}),
    )) as {
      name?: unknown;
      description?: unknown;
      isActive?: unknown;
      permissionIds?: unknown;
    };

  const nextName =
    typeof body.name === "string"
      ? body.name.trim()
      : undefined;

  const nextDescription =
    typeof body.description ===
      "string"
      ? body.description.trim()
      : undefined;

  const nextActive =
    typeof body.isActive ===
      "boolean"
      ? body.isActive
      : undefined;

  const requestedPermissionIds =
    Array.isArray(
      body.permissionIds,
    )
      ? Array.from(
          new Set(
            body.permissionIds.filter(
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
        error: "INVALID_ROLE_NAME",
      },
      {
        status: 400,
      },
    );
  }

  if (
    current.key === "SUPER_ADMIN" &&
    (
      nextActive === false ||
      requestedPermissionIds !==
        undefined
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "SUPER_ADMIN_ROLE_PROTECTED",
        message:
          "The Super Administrator role cannot be disabled or have its permissions reduced.",
      },
      {
        status: 409,
      },
    );
  }

  if (
    nextActive === false &&
    current._count.users > 0
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "ROLE_IS_ASSIGNED",
        message:
          "Move all users to another role before disabling this role.",
      },
      {
        status: 409,
      },
    );
  }

  let permissions:
    Array<{
      id: string;
      key: string;
    }> =
      current.permissions.map(
        (grant) => ({
          id: grant.permission.id,
          key: grant.permission.key,
        }),
      );

  if (
    requestedPermissionIds !==
      undefined
  ) {
    permissions =
      await prisma.administrationPermission.findMany({
        where: {
          id: {
            in:
              requestedPermissionIds,
          },
        },
        select: {
          id: true,
          key: true,
        },
      });

    if (
      permissions.length !==
      requestedPermissionIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_PERMISSION",
        },
        {
          status: 400,
        },
      );
    }
  }

  const previousPermissionKeys =
    current.permissions.map(
      (grant) =>
        grant.permission.key,
    );

  const nextPermissionKeys =
    permissions.map(
      (permission) =>
        permission.key,
    );

  const changedFields: string[] = [];

  if (
    nextName !== undefined &&
    nextName !== current.name
  ) {
    changedFields.push("name");
  }

  if (
    nextDescription !== undefined &&
    nextDescription !==
      (current.description ?? "")
  ) {
    changedFields.push(
      "description",
    );
  }

  if (
    nextActive !== undefined &&
    nextActive !== current.isActive
  ) {
    changedFields.push("isActive");
  }

  if (
    requestedPermissionIds !==
      undefined
  ) {
    changedFields.push(
      "permissions",
    );
  }

  const role =
    await prisma.$transaction(
      async (tx) => {
        if (
          requestedPermissionIds !==
            undefined
        ) {
          await tx.administrationRolePermission.deleteMany({
            where: {
              roleId: current.id,
              permissionId: {
                notIn:
                  requestedPermissionIds,
              },
            },
          });

          await tx.administrationRolePermission.createMany({
            data:
              permissions.map(
                (permission) => ({
                  roleId:
                    current.id,
                  permissionId:
                    permission.id,
                }),
              ),
            skipDuplicates: true,
          });
        }

        const updated =
          await tx.administrationRole.update({
            where: {
              id: current.id,
            },
            data: {
              name: nextName,
              description:
                nextDescription !==
                  undefined
                  ? nextDescription ||
                    null
                  : undefined,
              isActive: nextActive,
            },
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
              isSystem: true,
              isActive: true,
              _count: {
                select: {
                  users: true,
                },
              },
              permissions: {
                select: {
                  permission: {
                    select: {
                      id: true,
                      key: true,
                      module: true,
                      action: true,
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
            action: "ROLE_UPDATED",
            targetType: "ROLE",
            targetId: current.id,
            evidence: {
              roleKey: current.key,
              changedFields,
              previousPermissionKeys,
              permissionKeys:
                nextPermissionKeys,
              active:
                updated.isActive,
              containsPersonalData:
                false,
            },
          },
        });

        return updated;
      },
    );

  return NextResponse.json({
    success: true,
    role,
  });
}
