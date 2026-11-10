import type { WorkspaceProvider, WorkspaceTask } from "@/modules/core/contracts/workspace";
import { prisma } from "@/lib/prisma";
export const provider: WorkspaceProvider = { moduleId: "customers", cardIds: ["newProfiles"], createTask(context) {
        const { ids, range: r, assign } = context;
        const wants = (id: typeof ids[number]) => ids.includes(id);
        const tasks: WorkspaceTask[] = [];
        if (wants("newProfiles"))
            tasks.push({ ids: ["newProfiles"], run: async () => { const [a, b] = await Promise.all([prisma.normalCustomer.count({ where: { createdAt: { gte: r.from, lt: r.to } } }), prisma.normalCustomer.count({ where: { createdAt: { gte: r.previousFrom, lt: r.previousTo } } })]); assign("newProfiles", a, b); } });
        return tasks[0] ?? null;
    } };
