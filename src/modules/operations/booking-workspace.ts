import type { WorkspaceProvider, WorkspaceTask } from "@/modules/core/contracts/workspace";
import { Prisma } from "@/generated/prisma/client";
import { workspaceQuery as query } from "@/modules/shared/workspace-query";
export const provider: WorkspaceProvider = { moduleId: "operations", cardIds: ["booked", "pickups", "completed", "cancelled", "noFare"], createTask(context) {
        const { ids, range: r, assign } = context;
        const tasks: WorkspaceTask[] = [];
        const bookings = ids.filter(id => ["booked", "pickups", "completed", "cancelled", "noFare"].includes(id));
        if (bookings.length)
            tasks.push({ ids: bookings, run: async () => {
                    const counts = async (from: Date, to: Date, scheduledTo: Date) => {
                        const [a] = await query<Record<string, number>>(Prisma.sql `SELECT
   count(*) FILTER(WHERE "bookedAtTime">=${from} AND "bookedAtTime"<${to})::int booked,
   count(*) FILTER(WHERE "pickupDueTime">=${from} AND "pickupDueTime"<${scheduledTo})::int pickups,
   count(*) FILTER(WHERE status='COMPLETED' AND "completedAt">=${from} AND "completedAt"<${to})::int completed,
   count(*) FILTER(WHERE "cancelledAt">=${from} AND "cancelledAt"<${to})::int cancelled,
   count(*) FILTER(WHERE status IN ('NO_FARE','NOFARE') AND "noFareAt">=${from} AND "noFareAt"<${to})::int "noFare"
   FROM "Booking" WHERE ("bookedAtTime">=${from} AND "bookedAtTime"<${to}) OR ("pickupDueTime">=${from} AND "pickupDueTime"<${scheduledTo}) OR ("completedAt">=${from} AND "completedAt"<${to}) OR ("cancelledAt">=${from} AND "cancelledAt"<${to}) OR ("noFareAt">=${from} AND "noFareAt"<${to})`);
                        return a;
                    };
                    const [a, b] = await Promise.all([counts(r.from, r.to, r.scheduledTo), counts(r.previousFrom, r.previousTo, r.previousScheduledTo)]);
                    for (const id of bookings)
                        assign(id, Number(a[id]), Number(b[id]));
                } });
        return tasks[0] ?? null;
    } };
