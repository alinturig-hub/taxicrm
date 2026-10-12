export type IconName =
  | "dashboard"
  | "live"
  | "bookings"
  | "drivers"
  | "fleet"
  | "customers"
  | "executive"
  | "performance"
  | "revenue"
  | "reports"
  | "copilot"
  | "insights"
  | "predictions"
  | "automation"
  | "autocab"
  | "webhooks"
  | "sync"
  | "keys"
  | "users"
  | "roles"
  | "company"
  | "system";
export type NavigationItem = {
  label: string;
  href: string;
  icon: IconName;
  description: string;
  permission: string;
  legacyRoles?: string[];
  available: boolean;
};
export type NavigationGroup = {
  id: string;
  label: string;
  description: string;
  items: NavigationItem[];
};
const item = (
  label: string,
  href: string,
  icon: IconName,
  description: string,
  permission: string,
  legacyRoles?: string[],
): NavigationItem => ({
  label,
  href,
  icon,
  description,
  permission,
  legacyRoles,
  available: true,
});
export const navigationGroups: NavigationGroup[] = [
  {
    id: "overview",
    label: "Today",
    description: "Choose your workspace or review the business overview.",
    items: [
      item(
        "Today",
        "/dashboard/workspace",
        "dashboard",
        "All TaxiCRM modules, organised around your work.",
        "dashboard.view",
      ),
    ],
  },
  {
    id: "operations",
    label: "Operations",
    description:
      "Manage today's bookings, drivers, fleet and service coverage.",
    items: [
      item(
        "Operations hub",
        "/dashboard/operations",
        "dashboard",
        "A focused starting point for daily taxi operations.",
        "bookings.view",
      ),
      item(
        "Live operations",
        "/dashboard/live",
        "live",
        "Monitor booking activity and operational alerts.",
        "bookings.view",
      ),
      item(
        "Bookings",
        "/dashboard/bookings",
        "bookings",
        "Search journeys, pricing, status and booking history.",
        "bookings.view",
      ),
      item(
        "Drivers",
        "/dashboard/drivers",
        "drivers",
        "Driver records, activity and individual profiles.",
        "drivers.view",
      ),
      item(
        "Fleet",
        "/dashboard/fleet",
        "fleet",
        "Vehicle status and the live fleet map.",
        "fleet.view",
      ),
      item(
        "Zones",
        "/dashboard/zones",
        "fleet",
        "Explore the saved Autocab operating zones.",
        "fleet.view",
      ),
    ],
  },
  {
    id: "customers",
    label: "Customers",
    description:
      "Understand the people and account customers behind each booking.",
    items: [
      item(
        "Customers",
        "/dashboard/customers",
        "customers",
        "Accounts, customer profiles, booking histories and behaviour tags.",
        "customers.view",
      ),
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    description:
      "Explore audiences and customer opportunities before planning outreach.",
    items: [
      item(
        "Marketing hub",
        "/dashboard/marketing",
        "dashboard",
        "Customer audiences and the path from insights to outreach.",
        "customers.view",
      ),
      item(
        "Audience segments",
        "/dashboard/marketing/segments",
        "customers",
        "Filter customer audiences using the existing behaviour tags.",
        "customers.view",
      ),
      item(
        "Customer opportunities",
        "/dashboard/marketing/opportunities",
        "predictions",
        "Review customer demand predictions and their supporting evidence.",
        "intelligence.view",
      ),
    ],
  },
  {
    id: "intelligence",
    label: "Performance",
    description: "Turn recorded activity into business and customer insights.",
    items: [
      item(
        "Business overview",
        "/dashboard",
        "executive",
        "Revenue, booking activity and business performance.",
        "dashboard.view",
      ),
      item(
        "Executive intelligence",
        "/dashboard/intelligence/executive",
        "executive",
        "Explore business performance in detail.",
        "intelligence.view",
      ),
      item(
        "Hackney performance",
        "/dashboard/intelligence/hackney",
        "performance",
        "Driver performance by badge and London business periods.",
        "drivers.view",
      ),
      item(
        "AI copilot",
        "/dashboard/ai/copilot",
        "copilot",
        "Ask questions using the existing CRM copilot.",
        "intelligence.view",
      ),
      item(
        "Insights",
        "/dashboard/ai/insights",
        "insights",
        "Review recorded customer and operational signals.",
        "intelligence.view",
      ),
      item(
        "Predictions",
        "/dashboard/ai/predictions",
        "predictions",
        "Customer intelligence and booking demand forecasts.",
        "intelligence.view",
      ),
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connect external data and inspect how it enters TaxiCRM.",
    items: [
      item(
        "Integrations hub",
        "/dashboard/integrations/overview",
        "sync",
        "Connections, received events and saved API data sources.",
        "integrations.view",
      ),
      item(
        "Autocab integration",
        "/dashboard/integrations/autocab",
        "autocab",
        "Autocab credentials, webhook events, API sources and entity synchronisation.",
        "integrations.view",
      ),
      item(
        "Local integration",
        "/dashboard/integrations/local",
        "keys",
        "Local data imports, saved datasets and local system connections.",
        "integrations.view",
      ),
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    description:
      "Manage operational rules, communications, access and data quality.",
    items: [
      item(
        "Configuration hub",
        "/dashboard/configuration",
        "system",
        "One place for platform settings and administration.",
        "configuration.view",
      ),
      item(
        "SMS & freephone alerts",
        "/dashboard/configuration/sms",
        "automation",
        "Orion gateway, monitored lines, event recipients and delivery history.",
        "configuration.view",
        ["ADMIN", "MANAGER"],
      ),
      item(
        "Account revenue rules",
        "/dashboard/configuration/accounts",
        "revenue",
        "Existing provider and account-specific financial rules.",
        "configuration.view",
      ),
      item(
        "Driver rent",
        "/dashboard/configuration/driver-rent",
        "drivers",
        "Rent percentage and weekly caps.",
        "configuration.view",
      ),
      item(
        "Places intelligence",
        "/dashboard/configuration/geoapify",
        "fleet",
        "Geoapify settings, saved places and enrichment coverage.",
        "configuration.view",
      ),
      item(
        "City & contextual events",
        "/dashboard/configuration/contextual-events",
        "bookings",
        "Calendar context for customer intelligence.",
        "configuration.view",
      ),
      item(
        "Autocab API data sources",
        "/dashboard/configuration/api-endpoints",
        "keys",
        "Preview Autocab API responses and inspect saved records.",
        "configuration.view",
      ),
      item(
        "Webhook configuration",
        "/dashboard/configuration/webhooks",
        "webhooks",
        "Configure webhook rules and delivery endpoints separately from received events.",
        "configuration.view",
      ),
      item(
        "Place review",
        "/dashboard/administration/place-review",
        "system",
        "Review place categories and amenities.",
        "configuration.view",
      ),
      item(
        "Automation",
        "/dashboard/ai/automation",
        "automation",
        "Review rules and simulate existing automations.",
        "automation.view",
      ),
      item(
        "Users",
        "/dashboard/administration/users",
        "users",
        "User access and account administration.",
        "users.view",
      ),
      item(
        "Roles & permissions",
        "/dashboard/administration/roles",
        "roles",
        "Existing role grants and access permissions.",
        "roles.view",
      ),
      item(
        "System health",
        "/dashboard/configuration/system-health",
        "live",
        "Intelligence jobs, snapshots and data coverage.",
        "system_health.view",
      ),
    ],
  },
];
export function visibleNavigation(
  permissions: readonly string[],
  role: string,
) {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (i) =>
          permissions.includes(i.permission) &&
          (!i.legacyRoles || i.legacyRoles.includes(role)),
      ),
    }))
    .filter((group) => group.items.length);
}
export function activeNavigation(
  pathname: string,
  groups: NavigationGroup[] = navigationGroups,
) {
  const candidates = groups
    .flatMap((group) => group.items.map((item) => ({ group, item })))
    .filter(
      ({ item }) =>
        pathname === item.href ||
        (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")),
    );
  return (
    candidates.sort((a, b) => b.item.href.length - a.item.href.length)[0] ??
    null
  );
}
export function searchNavigation(query: string, groups: NavigationGroup[]) {
  const needle = query.trim().toLocaleLowerCase();
  return groups
    .flatMap((group) =>
      group.items.map((item) => ({ ...item, module: group.label })),
    )
    .filter(
      (item) =>
        !needle ||
        `${item.module} ${item.label} ${item.description}`
          .toLocaleLowerCase()
          .includes(needle),
    )
    .slice(0, 12);
}
