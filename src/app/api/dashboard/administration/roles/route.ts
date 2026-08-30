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

function roleKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  const session =
    await getServerSession(authOptions);

  const access =
    await requireAdministrationPermission(
      session?.user?.email,
      ADMINISTRATION_PERMISSIONS
        .ROLES_VIEW,
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
    roles,
    permissions,
  ] = await Promise.all([
    prisma.administrationRole.findMany({
      orderBy: [
        {
          isSystem: "desc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
          },
        },
        permissions: {
          orderBy: {
            permission: {
              key: "asc",
            },
          },
          select: {
            permission: {
              select: {
                id: true,
                key: true,
                module: true,
                action: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    }),

    prisma.administrationPermission.findMany({
      orderBy: [
        {
          module: "asc",
        },
        {
          action: "asc",
        },
      ],
      select: {
        id: true,
        key: true,
        module: true,
        action: true,
        name: true,
        description: true,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    roles,
    permissions,
    currentUser: {
      id: access.user.id,
      isSuperAdmin:
        access.isSuperAdmin,
      canManage:
        access.isSuperAdmin ||
        access.permissions.includes(
          ADMINISTRATION_PERMISSIONS
            .ROLES_MANAGE,
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

  const body =
    (await request.json().catch(
      () => ({}),
    )) as {
      name?: unknown;
      description?: unknown;
      permissionIds?: unknown;
    };

  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  const description =
    typeof body.description ===
      "string"
      ? body.description.trim()
      : "";

  const permissionIds =
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
      : [];

  const key = roleKey(name);

  if (
    name.length < 2 ||
    key.length < 2
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

  const existing =
    await prisma.administrationRole.findUnique({
      where: {
        key,
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
          "ROLE_ALREADY_EXISTS",
      },
      {
        status: 409,
      },
    );
  }

  const validPermissions =
    await prisma.administrationPermission.findMany({
      where: {
        id: {
          in: permissionIds,
        },
      },
      select: {
        id: true,
        key: true,
      },
    });

  if (
    validPermissions.length !==
    permissionIds.length
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

  const role =
    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.administrationRole.create({
            data: {
              key,
              name,
              description:
                description || null,
              isSystem: false,
              isActive: true,
              permissions: {
                create:
                  validPermissions.map(
                    (permission) => ({
                      permissionId:
                        permission.id,
                    }),
                  ),
              },
            },
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
              isSystem: true,
              isActive: true,
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
            action: "ROLE_CREATED",
            targetType: "ROLE",
            targetId: created.id,
            evidence: {
              roleKey: key,
              permissionKeys:
                validPermissions.map(
                  (permission) =>
                    permission.key,
                ),
              isSystem: false,
              containsPersonalData:
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
      role,
    },
    {
      status: 201,
    },
  );
}
