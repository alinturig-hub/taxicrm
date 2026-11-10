import type { WorkspaceProvider, WorkspaceTask } from "@/modules/core/contracts/workspace";
import { Prisma } from "@/generated/prisma/client";
import { workspaceQuery as query } from "@/modules/shared/workspace-query";
export const provider: WorkspaceProvider = { moduleId: "financial", cardIds: ["revenue", "margin"], createTask(context) {
        const { ids, range: r, assign } = context;
        const wants = (id: typeof ids[number]) => ids.includes(id);
        const tasks: WorkspaceTask[] = [];
        if (wants("revenue") || wants("margin"))
            tasks.push({ ids: ids.filter(id => id === "revenue" || id === "margin"), run: async () => {
                    const money = async (from: Date, to: Date) => {
                        const [a] = await query<{
                            gross: string;
                            margin: string | null;
                            total: number;
                            missingPrice: number;
                            missingCost: number;
                        }>(Prisma.sql `SELECT coalesce(sum(price),0)::text gross,
   CASE WHEN count(*) FILTER(WHERE price IS NULL OR cost IS NULL)>0 THEN NULL ELSE coalesce(sum(price-cost),0)::text END margin,
   count(*)::int total,count(*) FILTER(WHERE price IS NULL)::int "missingPrice",count(*) FILTER(WHERE cost IS NULL)::int "missingCost"
   FROM "Booking" WHERE status='COMPLETED' AND "completedAt">=${from} AND "completedAt"<${to}`);
                        return a;
                    };
                    const [a, b] = await Promise.all([money(r.from, r.to), money(r.previousFrom, r.previousTo)]);
                    assign("revenue", a.total > 0 && a.missingPrice === a.total ? null : Number(a.gross), b.missingPrice ? null : Number(b.gross), { state: a.total > 0 && a.missingPrice === a.total ? "UNAVAILABLE" : a.missingPrice ? "PARTIAL" : "OK", detail: a.missingPrice ? `${a.total - a.missingPrice} of ${a.total} completed journeys have a recorded Price; ${a.missingPrice} missing.` : undefined });
                    assign("margin", a.margin === null ? null : Number(a.margin), b.margin === null ? null : Number(b.margin), { state: a.margin === null ? "UNAVAILABLE" : "OK", detail: a.margin === null ? `${a.missingPrice} missing Price and ${a.missingCost} missing Cost values. No net profit is inferred.` : undefined });
                } });
        return tasks[0] ?? null;
    } };
