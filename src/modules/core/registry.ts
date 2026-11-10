export const modules = {
    core: { label: "Core", description: "Authentication, users, roles, audit and shared coordination.", stage: "shared" },
    workspace: { label: "My workspace", description: "Personal layout and aggregation of published module cards.", stage: "orchestration-extracted" },
    integrations: { label: "Integration registry", description: "Source selection, connection registry and the shared event journal.", stage: "provider-extracted" },
    needacabplus: { label: "NeedACab Plus integration", description: "Existing shared-source connection and fleet adapter.", stage: "mapped" },
    autocab: { label: "Autocab direct", description: "Autocab API settings, webhook definitions and direct ingestion adapters.", stage: "mapped" },
    operations: { label: "Operations", description: "Existing booking, driver, fleet and zone workspaces.", stage: "provider-extracted" },
    customers: { label: "Customers", description: "Contact identity, booking history and customer directory.", stage: "provider-extracted" },
    retention: { label: "Retention", description: "Existing completed-trip lifecycle, configurable tags and relationship signals.", stage: "mapped" },
    predictions: { label: "Predictions", description: "Existing versioned customer ranking, demand forecasts and evaluation.", stage: "provider-extracted" },
    marketing: { label: "Marketing", description: "Campaigns, audiences, vouchers and marketing history.", stage: "mapped" },
    communications: { label: "Communications transport", description: "Shared WhatsApp transport, receipt processing and notification infrastructure.", stage: "mapped" },
    financial: { label: "Financial", description: "Price, Cost, margins, account rules and driver-rent configuration.", stage: "provider-extracted" },
    analytics: { label: "Analytics", description: "Existing analytical exploration and query services.", stage: "mapped" },
    reports: { label: "Reports", description: "Existing detailed contribution/performance reports; no new report engine.", stage: "mapped" },
    businessOverview: { label: "Business overview", description: "Existing executive business views and their summaries.", stage: "mapped" },
    insights: { label: "Insights", description: "Existing recorded business/customer insights.", stage: "mapped" },
    ai: { label: "AI", description: "Existing Copilot chat; separate owner-agent draft is not activated here.", stage: "mapped" },
    places: { label: "Places intelligence", description: "Existing enrichment, category review and Geoapify configuration.", stage: "mapped" },
    automation: { label: "Automation", description: "Existing rule definitions and simulations.", stage: "mapped" },
    context: { label: "Contextual events", description: "Existing city/calendar context and bank-holiday settings.", stage: "mapped" },
} as const;
export type ModuleId = keyof typeof modules;
// Ownership is descriptive in this compatibility release. It is NOT an enable switch.
// Runtime gating must cover routes, jobs, transport and source exclusivity before
// an administrator is offered a functional enable/disable control.
export const workspaceCardOwner = {
    booked: "operations", pickups: "operations", completed: "operations", cancelled: "operations", noFare: "operations",
    revenue: "financial", margin: "financial", returning: "customers", newProfiles: "customers", predictions: "predictions", failed: "integrations", retention: "retention", campaigns: "marketing",
} as const satisfies Record<import("./contracts/workspace").WorkspaceCardId, ModuleId>;
