import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export const ADMINISTRATION_PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  BOOKINGS_VIEW: "bookings.view",
  BOOKINGS_MANAGE: "bookings.manage",
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",
  INTELLIGENCE_VIEW: "intelligence.view",
  AUTOMATION_VIEW: "automation.view",
  AUTOMATION_MANAGE: "automation.manage",
  DRIVERS_VIEW: "drivers.view",
  DRIVERS_MANAGE: "drivers.manage",
  FLEET_VIEW: "fleet.view",
  FLEET_MANAGE: "fleet.manage",
  REVENUE_VIEW: "revenue.view",
  REPORTS_VIEW: "reports.view",
  INTEGRATIONS_VIEW: "integrations.view",
  INTEGRATIONS_MANAGE: "integrations.manage",
  CONFIGURATION_VIEW: "configuration.view",
  CONFIGURATION_MANAGE: "configuration.manage",
  SYSTEM_HEALTH_VIEW: "system_health.view",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",
  AUDIT_VIEW: "audit.view",
} as const;

export type AdministrationPermissionKey =
  typeof ADMINISTRATION_PERMISSIONS[
    keyof typeof ADMINISTRATION_PERMISSIONS
  ];

const ALL_PERMISSION_KEYS =
  Object.values(
    ADMINISTRATION_PERMISSIONS,
  );

function legacyPermissions(
  role: string,
): AdministrationPermissionKey[] {
  if (role === "ADMIN") {
    return [...ALL_PERMISSION_KEYS];
  }

  if (role === "MANAGER") {
    return [
      ADMINISTRATION_PERMISSIONS
        .DASHBOARD_VIEW,
      ADMINISTRATION_PERMISSIONS
        .BOOKINGS_VIEW,
      ADMINISTRATION_PERMISSIONS
        .BOOKINGS_MANAGE,
      ADMINISTRATION_PERMISSIONS
        .CUSTOMERS_VIEW,
      ADMINISTRATION_PERMISSIONS
        .CUSTOMERS_MANAGE,
      ADMINISTRATION_PERMISSIONS
        .INTELLIGENCE_VIEW,
      ADMINISTRATION_PERMISSIONS
        .AUTOMATION_VIEW,
      ADMINISTRATION_PERMISSIONS
        .AUTOMATION_MANAGE,
      ADMINISTRATION_PERMISSIONS
        .DRIVERS_VIEW,
      ADMINISTRATION_PERMISSIONS
        .DRIVERS_MANAGE,
      ADMINISTRATION_PERMISSIONS
        .FLEET_VIEW,
      ADMINISTRATION_PERMISSIONS
        .FLEET_MANAGE,
      ADMINISTRATION_PERMISSIONS
        .REVENUE_VIEW,
      ADMINISTRATION_PERMISSIONS
        .REPORTS_VIEW,
      ADMINISTRATION_PERMISSIONS
        .INTEGRATIONS_VIEW,
      ADMINISTRATION_PERMISSIONS
        .CONFIGURATION_VIEW,
      ADMINISTRATION_PERMISSIONS
        .SYSTEM_HEALTH_VIEW,
    ];
  }

  return [
    ADMINISTRATION_PERMISSIONS
      .DASHBOARD_VIEW,
    ADMINISTRATION_PERMISSIONS
      .BOOKINGS_VIEW,
    ADMINISTRATION_PERMISSIONS
      .BOOKINGS_MANAGE,
    ADMINISTRATION_PERMISSIONS
      .CUSTOMERS_VIEW,
    ADMINISTRATION_PERMISSIONS
      .INTELLIGENCE_VIEW,
    ADMINISTRATION_PERMISSIONS
      .DRIVERS_VIEW,
    ADMINISTRATION_PERMISSIONS
      .FLEET_VIEW,
  ];
}

export async function getAdministrationAccess(
  email: string | null | undefined,
) {
  const normalizedEmail =
    email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        roleAssignments: {
          where: {
            role: {
              isActive: true,
            },
          },
          select: {
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                isSystem: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        key: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

  if (!user || !user.isActive) {
    return null;
  }

  const roles =
    user.roleAssignments.map(
      (assignment) => ({
        id: assignment.role.id,
        key: assignment.role.key,
        name: assignment.role.name,
        isSystem:
          assignment.role.isSystem,
      }),
    );

  const assignedPermissions =
    new Set<
      AdministrationPermissionKey
    >();

  for (
    const assignment
    of user.roleAssignments
  ) {
    for (
      const grant
      of assignment.role.permissions
    ) {
      if (
        ALL_PERMISSION_KEYS.includes(
          grant.permission
            .key as AdministrationPermissionKey,
        )
      ) {
        assignedPermissions.add(
          grant.permission
            .key as AdministrationPermissionKey,
        );
      }
    }
  }

  if (roles.length === 0) {
    for (
      const permission
      of legacyPermissions(user.role)
    ) {
      assignedPermissions.add(
        permission,
      );
    }
  }

  const isSuperAdmin =
    roles.some(
      (role) =>
        role.key === "SUPER_ADMIN",
    );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      legacyRole: user.role,
    },
    roles,
    permissions:
      Array.from(
        assignedPermissions,
      ).sort(),
    isSuperAdmin,
  };
}

export async function hasAdministrationPermission(
  email: string | null | undefined,
  permission: AdministrationPermissionKey,
) {
  const access =
    await getAdministrationAccess(email);

  return Boolean(
    access &&
      (
        access.isSuperAdmin ||
        access.permissions.includes(
          permission,
        )
      ),
  );
}

export async function requireAdministrationPermission(
  email: string | null | undefined,
  permission: AdministrationPermissionKey,
) {
  const access =
    await getAdministrationAccess(email);

  if (
    !access ||
    (
      !access.isSuperAdmin &&
      !access.permissions.includes(
        permission,
      )
    )
  ) {
    return null;
  }

  return access;
}

export async function recordAdministrationAudit({
  actorUserId,
  action,
  targetType,
  targetId = null,
  evidence,
}: {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  evidence: Prisma.InputJsonValue;
}) {
  return prisma.administrationAuditEvent.create({
    data: {
      actorUserId,
      action,
      targetType,
      targetId,
      evidence,
    },
  });
}
