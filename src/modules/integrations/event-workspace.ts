import type { WorkspaceProvider, WorkspaceTask } from "@/modules/core/contracts/workspace";
import { prisma } from "@/lib/prisma";
export const provider: WorkspaceProvider = { moduleId: "integrations", cardIds: ["failed"], createTask(context) {
        const { ids, range: r, assign } = context;
        const wants = (id: typeof ids[number]) => ids.includes(id);
        const tasks: WorkspaceTask[] = [];
        if (wants("failed"))
            tasks.push({ ids: ["failed"], run: async () => { const [a, b] = await Promise.all([prisma.webhookEvent.count({ where: { receivedAt: { gte: r.from, lt: r.to }, status: "FAILED" } }), prisma.webhookEvent.count({ where: { receivedAt: { gte: r.previousFrom, lt: r.previousTo }, status: "FAILED" } })]); assign("failed", a, b); } });
        return tasks[0] ?? null;
    } };
