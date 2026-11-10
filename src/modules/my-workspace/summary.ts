import { predictionAvailability } from "@/modules/predictions/lifecycle";
import { allowedCards, workspaceRange, type Can, type WorkspaceCard, type WorkspacePeriod } from "@/lib/workspace/home/config";
import type { WorkspaceMetric, WorkspaceSummary } from "@/modules/core/contracts/workspace";
export type { WorkspaceMetric, WorkspaceSummary } from "@/modules/core/contracts/workspace";
import { workspaceProviders } from "./providers";
export async function workspaceSummary(requested: WorkspaceCard[], period: WorkspacePeriod, can: Can, now = new Date()): Promise<WorkspaceSummary> {
    const predictionMode = requested.includes("predictions") ? await predictionAvailability() : null;
    const permitted = allowedCards(can), ids = requested.filter(id => permitted.includes(id) && (id !== "predictions" || predictionMode?.status === "ENABLED")), metrics: WorkspaceSummary["metrics"] = {};
    const r = workspaceRange(period, now), range = { from: r.from.toISOString(), to: r.to.toISOString() };
    const assign = (id: WorkspaceCard, value: number | null, previous: number | null, extra: Partial<WorkspaceMetric> = {}) => {
        if (ids.includes(id))
            metrics[id] = { value, previous, state: "OK", ...extra };
    };
    const context = { ids, range: r, now, assign };
    const tasks = workspaceProviders.flatMap(provider => { const task = provider.createTask(context); return task ? [task] : []; });
    const outcomes = await Promise.allSettled(tasks.map(task => task.run()));
    outcomes.forEach((outcome, i) => {
        if (outcome.status === "rejected")
            for (const id of tasks[i].ids)
                metrics[id] = { value: null, previous: null, state: "UNAVAILABLE", detail: "This figure could not be loaded. Try Refresh." };
    });
    return { period, ...range, generatedAt: now.toISOString(), metrics };
}
