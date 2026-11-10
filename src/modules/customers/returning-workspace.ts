import type { WorkspaceProvider, WorkspaceTask } from "@/modules/core/contracts/workspace";
import { Prisma } from "@/generated/prisma/client";
import { workspaceQuery as query } from "@/modules/shared/workspace-query";
export const provider: WorkspaceProvider = { moduleId: "customers", cardIds: ["returning"], createTask(context) {
        const { ids, range: r, assign } = context;
        const wants = (id: typeof ids[number]) => ids.includes(id);
        const tasks: WorkspaceTask[] = [];
        if (wants("returning"))
            tasks.push({ ids: ["returning"], run: async () => {
                    const count = async (from: Date, to: Date) => {
                        const [a] = await query<{
                            n: number;
                        }>(Prisma.sql `WITH linked AS (SELECT "normalCustomerId" id,max("completedAt") last_at FROM "Booking" WHERE "normalCustomerId" IS NOT NULL AND status='COMPLETED' AND "completedAt">=${from} AND "completedAt"<${to} GROUP BY "normalCustomerId") SELECT count(*)::int n FROM linked x WHERE EXISTS(SELECT 1 FROM "Booking" p WHERE p."normalCustomerId"=x.id AND p.status='COMPLETED' AND p."completedAt"<x.last_at)`);
                        return a.n;
                    };
                    const [a, b] = await Promise.all([count(r.from, r.to), count(r.previousFrom, r.previousTo)]);
                    assign("returning", a, b);
                } });
        return tasks[0] ?? null;
    } };
