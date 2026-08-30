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

export async function GET() {
  const session =
    await getServerSession(authOptions);

  const access =
    await requireAdministrationPermission(
      session?.user?.email,
      ADMINISTRATION_PERMISSIONS
        .USERS_VIEW,
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

  const [
    users,
    roles,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: [
        {
          isActive: "desc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        passwordChangedAt: true,
        deactivatedAt: true,
        createdAt: true,
        updatedAt: true,
        roleAssignments: {
          orderBy: {
            role: {
              name: "asc",
            },
          },
          select: {
            assignedAt: true,
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                description: true,
                isSystem: true,
                isActive: true,
              },
            },
          },
        },
      },
    }),

    prisma.administrationRole.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    users,
    roles,
    currentUser: {
      id: access.user.id,
      isSuperAdmin:
        access.isSuperAdmin,
      canManage:
        access.isSuperAdmin ||
        access.permissions.includes(
          ADMINISTRATION_PERMISSIONS
            .USERS_MANAGE,
        ),
    },
  });
}

export async function POST(
  request: NextRequest,
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
      name?: unknown;
      email?: unknown;
      temporaryPassword?: unknown;
      roleIds?: unknown;
    };

  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  const email =
    typeof body.email === "string"
      ? body.email
          .trim()
          .toLowerCase()
      : "";

  const temporaryPassword =
    typeof body.temporaryPassword ===
      "string"
      ? body.temporaryPassword
      : "";

  const roleIds =
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
      : [];

  if (
    name.length < 2 ||
    !email.includes("@") ||
    temporaryPassword.length < 12 ||
    roleIds.length === 0
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "INVALID_INPUT",
        message:
          "Name, valid email, a 12-character temporary password and at least one role are required.",
      },
      {
        status: 400,
      },
    );
  }

  const existing =
    await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

  if (existing) {
    return NextResponse.json(
      {
        success: false,
        error:
          "EMAIL_ALREADY_EXISTS",
      },
      {
        status: 409,
      },
    );
  }

  const roles =
    await prisma.administrationRole.findMany({
      where: {
        id: {
          in: roleIds,
        },
        isActive: true,
      },
      select: {
        id: true,
        key: true,
      },
    });

  if (roles.length !== roleIds.length) {
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

  if (
    roles.some(
      (role) =>
        role.key ===
        "SUPER_ADMIN",
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

  const passwordHash =
    await hash(
      temporaryPassword,
      12,
    );

  const roleKeys =
    roles.map(
      (role) => role.key,
    );

  const user =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.user.create({
            data: {
              name,
              email,
              passwordHash,
              role:
                legacyRole(
                  roleKeys,
                ),
              isActive: true,
              mustChangePassword:
                true,
              roleAssignments: {
                create:
                  roles.map(
                    (role) => ({
                      roleId:
                        role.id,
                      assignedByUserId:
                        access.user.id,
                    }),
                  ),
              },
            },
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              mustChangePassword:
                true,
              createdAt: true,
              roleAssignments: {
                select: {
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
            action: "USER_CREATED",
            targetType: "USER",
            targetId: created.id,
            evidence: {
              roleKeys,
              active: true,
              temporaryPassword:
                true,
              containsPassword:
                false,
            },
          },
        });

        return created;
      },
    );

  return NextResponse.json(
    {
      success: true,
      user,
    },
    {
      status: 201,
    },
  );
}
