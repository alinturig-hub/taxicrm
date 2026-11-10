import type { ModuleId } from "./registry";
type Ownership = {
    moduleId: ModuleId;
    prefix: string;
};
// Longest prefix wins. Existing URLs are compatibility adapters, not rewritten.
export const routeOwnership: readonly Ownership[] = [
    ...["/api/auth", "/api/health", "/login", "/privacy", "/change-password", "/dashboard/administration/users", "/dashboard/administration/roles", "/api/dashboard/administration/users", "/api/dashboard/administration/roles", "/dashboard/configuration/system-health", "/api/dashboard/configuration/system-health", "/api/internal/crm-post-commit-worker", "/api/internal/booking-post-commit"].map(prefix => ({ moduleId: "core" as const, prefix })),
    ...["/dashboard/workspace", "/dashboard/command-center", "/api/dashboard/workspace"].map(prefix => ({ moduleId: "workspace" as const, prefix })),
    ...["/dashboard/integrations/autocab", "/dashboard/configuration/api-endpoints", "/dashboard/configuration/webhooks/add", "/dashboard/configuration/webhooks", "/api/dashboard/autocab/providers", "/api/dashboard/autocab/webhooks", "/api/dashboard/integrations/autocab", "/api/dashboard/configuration/api-endpoints", "/api/webhooks/autocab", "/api/internal/webhook-processor", "/api/internal/driver-registry-sync", "/api/internal/fleet-registry-sync"].map(prefix => ({ moduleId: "autocab" as const, prefix })),
    ...["/dashboard/integrations/needacabplus", "/api/internal/needacabplus"].map(prefix => ({ moduleId: "needacabplus" as const, prefix })),
    ...["/dashboard/integrations", "/dashboard/configuration/webhooks/events", "/api/dashboard/autocab/events", "/api/dashboard/integrations", "/api/dashboard/configuration/integrations-disable", "/api/internal/webhook-readiness"].map(prefix => ({ moduleId: "integrations" as const, prefix })),
    ...["/dashboard/configuration/whatsapp", "/dashboard/configuration/sms", "/dashboard/integrations/whatsapp", "/api/dashboard/configuration/whatsapp", "/api/dashboard/configuration/sms", "/api/internal/whatsapp", "/api/webhooks/whatsapp", "/api/internal/notifications", "/api/internal/freephone"].map(prefix => ({ moduleId: "communications" as const, prefix })),
    ...["/dashboard/marketing", "/api/dashboard/marketing", "/api/dashboard/whatsapp/flows"].map(prefix => ({ moduleId: "marketing" as const, prefix })),
    ...["/dashboard/customers/time-tag-rules", "/api/dashboard/customers/time-tag-rules", "/api/dashboard/customers/tags/recalculate"].map(prefix => ({ moduleId: "retention" as const, prefix })),
    ...["/dashboard/customers", "/api/dashboard/customers", "/api/internal/customer-profile-audit", "/api/internal/customer-rebuild"].map(prefix => ({ moduleId: "customers" as const, prefix })),
    ...["/dashboard/ai/predictions", "/dashboard/marketing/opportunities", "/api/dashboard/customers/predictions", "/api/internal/customer-booking-predictions", "/api/internal/booking-demand-forecast"].map(prefix => ({ moduleId: "predictions" as const, prefix })),
    ...["/dashboard/ai/insights", "/api/dashboard/ai/insights"].map(prefix => ({ moduleId: "insights" as const, prefix })),
    ...["/dashboard/ai/copilot", "/api/dashboard/ai/copilot"].map(prefix => ({ moduleId: "ai" as const, prefix })),
    ...["/dashboard/ai/automation", "/api/dashboard/ai/automation"].map(prefix => ({ moduleId: "automation" as const, prefix })),
    ...["/dashboard/analytics", "/api/dashboard/analytics", "/api/internal/analytics/rebuild"].map(prefix => ({ moduleId: "analytics" as const, prefix })),
    ...["/refusal-map", "/api/refusal-map", "/dashboard/analytics/contribution", "/api/dashboard/analytics/contribution", "/dashboard/intelligence/hackney", "/api/dashboard/driver-company-overview"].map(prefix => ({ moduleId: "reports" as const, prefix })),
    ...["/dashboard/intelligence/executive"].map(prefix => ({ moduleId: "businessOverview" as const, prefix })),
    ...["/dashboard/configuration/accounts", "/dashboard/configuration/driver-rent", "/api/dashboard/configuration/accounts", "/api/dashboard/configuration/driver-rent", "/api/internal/financial-audit", "/api/internal/booking-fare-backfill"].map(prefix => ({ moduleId: "financial" as const, prefix })),
    ...["/dashboard/configuration/geoapify", "/dashboard/administration/place-review", "/api/dashboard/integrations/geoapify", "/api/dashboard/administration/place-review"].map(prefix => ({ moduleId: "places" as const, prefix })),
    ...["/dashboard/configuration/contextual-events", "/api/dashboard/configuration/contextual-events"].map(prefix => ({ moduleId: "context" as const, prefix })),
    ...["/dashboard/bookings", "/dashboard/operations", "/dashboard/live", "/dashboard/drivers", "/dashboard/fleet", "/dashboard/zones", "/api/bookings", "/api/fleet", "/api/dashboard/live-operations", "/api/dashboard/drivers", "/api/dashboard/fleet", "/api/dashboard/zones", "/api/internal/shift-audit"].map(prefix => ({ moduleId: "operations" as const, prefix })),
];
export function moduleForRoute(path: string): ModuleId | null {
    if (path === "/")
        return "core";
    if (path === "/dashboard")
        return "businessOverview";
    if (path === "/dashboard/configuration")
        return "core";
    if (["/api/internal/customer-intelligence-refresh", "/api/internal/customer-profile-snapshots"].includes(path))
        return "core";
    const clean = path.split("?")[0].replace(/\/$/, "");
    return routeOwnership.filter(rule => clean === rule.prefix || clean.startsWith(rule.prefix + "/") || rule.prefix.endsWith("freephone") && clean.startsWith(rule.prefix + "-")).sort((a, b) => b.prefix.length - a.prefix.length)[0]?.moduleId ?? null;
}
export const sharedCoordinators = {
    "/api/internal/crm-post-commit-worker": ["customers", "predictions", "places", "businessOverview"],
    "/api/internal/booking-post-commit": ["customers", "predictions", "places", "businessOverview"],
    "/api/internal/customer-intelligence-refresh": ["customers", "retention", "predictions", "places"],
    "/api/internal/customer-profile-snapshots": ["customers", "retention", "predictions"],
} as const satisfies Record<string, readonly ModuleId[]>;
