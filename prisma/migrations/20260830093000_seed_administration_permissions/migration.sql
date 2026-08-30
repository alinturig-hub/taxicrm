INSERT INTO "AdministrationPermission" (
  "id",
  "key",
  "module",
  "action",
  "name",
  "updatedAt"
)
VALUES
  ('perm_dashboard_view', 'dashboard.view', 'DASHBOARD', 'VIEW', 'View dashboard', CURRENT_TIMESTAMP),
  ('perm_bookings_view', 'bookings.view', 'BOOKINGS', 'VIEW', 'View bookings', CURRENT_TIMESTAMP),
  ('perm_bookings_manage', 'bookings.manage', 'BOOKINGS', 'MANAGE', 'Manage bookings', CURRENT_TIMESTAMP),
  ('perm_customers_view', 'customers.view', 'CUSTOMERS', 'VIEW', 'View customers', CURRENT_TIMESTAMP),
  ('perm_customers_manage', 'customers.manage', 'CUSTOMERS', 'MANAGE', 'Manage customers', CURRENT_TIMESTAMP),
  ('perm_intelligence_view', 'intelligence.view', 'INTELLIGENCE', 'VIEW', 'View customer intelligence', CURRENT_TIMESTAMP),
  ('perm_drivers_view', 'drivers.view', 'DRIVERS', 'VIEW', 'View drivers', CURRENT_TIMESTAMP),
  ('perm_drivers_manage', 'drivers.manage', 'DRIVERS', 'MANAGE', 'Manage drivers', CURRENT_TIMESTAMP),
  ('perm_fleet_view', 'fleet.view', 'FLEET', 'VIEW', 'View fleet', CURRENT_TIMESTAMP),
  ('perm_fleet_manage', 'fleet.manage', 'FLEET', 'MANAGE', 'Manage fleet', CURRENT_TIMESTAMP),
  ('perm_revenue_view', 'revenue.view', 'REVENUE', 'VIEW', 'View revenue', CURRENT_TIMESTAMP),
  ('perm_reports_view', 'reports.view', 'REPORTS', 'VIEW', 'View reports', CURRENT_TIMESTAMP),
  ('perm_integrations_view', 'integrations.view', 'INTEGRATIONS', 'VIEW', 'View integrations', CURRENT_TIMESTAMP),
  ('perm_integrations_manage', 'integrations.manage', 'INTEGRATIONS', 'MANAGE', 'Manage integrations', CURRENT_TIMESTAMP),
  ('perm_configuration_view', 'configuration.view', 'CONFIGURATION', 'VIEW', 'View configuration', CURRENT_TIMESTAMP),
  ('perm_configuration_manage', 'configuration.manage', 'CONFIGURATION', 'MANAGE', 'Manage configuration', CURRENT_TIMESTAMP),
  ('perm_system_health_view', 'system_health.view', 'SYSTEM_HEALTH', 'VIEW', 'View system health', CURRENT_TIMESTAMP),
  ('perm_users_view', 'users.view', 'USERS', 'VIEW', 'View users', CURRENT_TIMESTAMP),
  ('perm_users_manage', 'users.manage', 'USERS', 'MANAGE', 'Manage users', CURRENT_TIMESTAMP),
  ('perm_roles_view', 'roles.view', 'ROLES', 'VIEW', 'View roles', CURRENT_TIMESTAMP),
  ('perm_roles_manage', 'roles.manage', 'ROLES', 'MANAGE', 'Manage roles', CURRENT_TIMESTAMP),
  ('perm_audit_view', 'audit.view', 'AUDIT', 'VIEW', 'View administration audit', CURRENT_TIMESTAMP);

INSERT INTO "AdministrationRolePermission" (
  "roleId",
  "permissionId"
)
SELECT
  role.id,
  permission.id
FROM "AdministrationRole" role
CROSS JOIN "AdministrationPermission" permission
WHERE role."key" IN (
  'SUPER_ADMIN',
  'ADMIN'
);

INSERT INTO "AdministrationRolePermission" (
  "roleId",
  "permissionId"
)
SELECT
  role.id,
  permission.id
FROM "AdministrationRole" role
CROSS JOIN "AdministrationPermission" permission
WHERE
  role."key" = 'OPERATIONS_MANAGER'
  AND permission."key" IN (
    'dashboard.view',
    'bookings.view',
    'bookings.manage',
    'customers.view',
    'customers.manage',
    'intelligence.view',
    'drivers.view',
    'drivers.manage',
    'fleet.view',
    'fleet.manage',
    'revenue.view',
    'reports.view',
    'integrations.view',
    'configuration.view',
    'system_health.view'
  );

INSERT INTO "AdministrationRolePermission" (
  "roleId",
  "permissionId"
)
SELECT
  role.id,
  permission.id
FROM "AdministrationRole" role
CROSS JOIN "AdministrationPermission" permission
WHERE
  role."key" = 'DISPATCHER'
  AND permission."key" IN (
    'dashboard.view',
    'bookings.view',
    'bookings.manage',
    'customers.view',
    'intelligence.view',
    'drivers.view',
    'fleet.view'
  );

INSERT INTO "AdministrationRolePermission" (
  "roleId",
  "permissionId"
)
SELECT
  role.id,
  permission.id
FROM "AdministrationRole" role
CROSS JOIN "AdministrationPermission" permission
WHERE
  role."key" = 'ANALYST'
  AND permission."key" IN (
    'dashboard.view',
    'bookings.view',
    'customers.view',
    'intelligence.view',
    'revenue.view',
    'reports.view',
    'system_health.view'
  );

INSERT INTO "AdministrationRolePermission" (
  "roleId",
  "permissionId"
)
SELECT
  role.id,
  permission.id
FROM "AdministrationRole" role
CROSS JOIN "AdministrationPermission" permission
WHERE
  role."key" = 'VIEWER'
  AND permission."key" IN (
    'dashboard.view',
    'bookings.view',
    'customers.view'
  );

INSERT INTO "AdministrationAuditEvent" (
  "id",
  "action",
  "targetType",
  "evidence",
  "occurredAt"
)
VALUES (
  'audit_initial_permission_catalog',
  'PERMISSION_CATALOG_INITIALIZED',
  'SYSTEM',
  '{"containsPersonalData":false,"permissions":22,"roles":6}'::jsonb,
  CURRENT_TIMESTAMP
);
