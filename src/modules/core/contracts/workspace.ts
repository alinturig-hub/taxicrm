import type { ModuleId } from "../registry";
export type WorkspaceCardId = "booked" | "pickups" | "completed" | "cancelled" | "noFare" | "revenue" | "margin" | "returning" | "newProfiles" | "predictions" | "failed" | "retention" | "campaigns";
export type WorkspacePeriod = "TODAY" | "YESTERDAY" | "LAST7" | "LAST30";
export type Can = (permission: string) => boolean;
export type WorkspaceMetric = {
    value: number | null;
    previous: number | null;
    state: "OK" | "PARTIAL" | "UNAVAILABLE";
    detail?: string;
    snapshot?: boolean;
};
export type WorkspaceSummary = {
    period: WorkspacePeriod;
    from: string;
    to: string;
    generatedAt: string;
    metrics: Partial<Record<WorkspaceCardId, WorkspaceMetric>>;
};
export type WorkspaceRange = {
    from: Date;
    to: Date;
    scheduledTo: Date;
    previousFrom: Date;
    previousTo: Date;
    previousScheduledTo: Date;
};
export type WorkspaceContext = {
    ids: WorkspaceCardId[];
    range: WorkspaceRange;
    now: Date;
    assign: (id: WorkspaceCardId, value: number | null, previous: number | null, extra?: Partial<WorkspaceMetric>) => void;
};
export type WorkspaceTask = {
    ids: WorkspaceCardId[];
    run: () => Promise<void>;
};
export type WorkspaceProvider = {
    moduleId: ModuleId;
    cardIds: readonly WorkspaceCardId[];
    createTask: (context: WorkspaceContext) => WorkspaceTask | null;
};
