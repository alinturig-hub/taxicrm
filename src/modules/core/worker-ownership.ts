import type { ModuleId } from "./registry";
export const workerOwnership = [
    { entrypoint: "/api/internal/driver-registry-sync", owner: "autocab", participants: [], existingControls: ["AUTOCAB_REST_INGEST_DISABLED"] },
    { entrypoint: "/api/internal/customer-intelligence-refresh", owner: "core", participants: ["customers", "retention", "predictions", "places"], existingControls: [] },
    { entrypoint: "/api/internal/notifications", owner: "communications", participants: [], existingControls: [] },
    { entrypoint: "/api/internal/webhook-processor", owner: "autocab", participants: [], existingControls: ["AUTOCAB_WEBHOOK_PROCESSING_PAUSED", "BOOKING_WEBHOOK_WRITER"] },
    { entrypoint: "/api/internal/crm-post-commit-worker", owner: "core", participants: ["customers", "predictions", "places", "businessOverview"], existingControls: ["CRM_POST_COMMIT_WORKER_ENABLED"] },
    { entrypoint: "/api/internal/customer-profile-snapshots", owner: "core", participants: ["customers", "retention", "predictions"], existingControls: [] },
    { entrypoint: "/api/internal/booking-demand-forecast", owner: "predictions", participants: [], existingControls: [] },
    { entrypoint: "/api/internal/customer-booking-predictions", owner: "predictions", participants: [], existingControls: [] },
    { entrypoint: "/api/dashboard/integrations/geoapify/enrich", owner: "places", participants: [], existingControls: [] },
    { entrypoint: "/api/internal/whatsapp/v1/worker", owner: "communications", participants: [], existingControls: ["WHATSAPP_SHARED_ENABLED"] },
    { entrypoint: "/api/internal/whatsapp/v1/worker/receipts", owner: "communications", participants: [], existingControls: ["WHATSAPP_SHARED_ENABLED", "WHATSAPP_RECEIPT_FAST_ENABLED"] },
] as const satisfies readonly {
    entrypoint: string;
    owner: ModuleId;
    participants: readonly ModuleId[];
    existingControls: readonly string[];
}[];
