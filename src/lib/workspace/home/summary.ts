import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { BOOKING_PREDICTION_MODEL_VERSION } from "@/lib/customers/booking-prediction-model";
import { allowedCards, workspaceRange, type Can, type WorkspaceCard, type WorkspacePeriod } from "./config";
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
    metrics: Partial<Record<WorkspaceCard, WorkspaceMetric>>;
};
async function query<T>(sql: Prisma.Sql) { return prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY"); await tx.$executeRawUnsafe("SET LOCAL statement_timeout='10s'"); await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'"); return tx.$queryRaw<T[]>(sql); }, { timeout: 15000 }); }
export async function workspaceSummary(requested: WorkspaceCard[], period: WorkspacePeriod, can: Can, now = new Date()): Promise<WorkspaceSummary> {
    const permitted = allowedCards(can), ids = requested.filter(id => permitted.includes(id)), metrics: WorkspaceSummary["metrics"] = {};
    const r = workspaceRange(period, now), range = { from: r.from.toISOString(), to: r.to.toISOString() };
    const wants = (id: WorkspaceCard) => ids.includes(id);
    const assign = (id: WorkspaceCard, value: number | null, previous: number | null, extra: Partial<WorkspaceMetric> = {}) => { if (wants(id))
        metrics[id] = { value, previous, state: "OK", ...extra }; };
    const tasks: Array<{
        ids: WorkspaceCard[];
        run: () => Promise<void>;
    }> = [];
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
    if (wants("returning"))
        tasks.push({ ids: ["returning"], run: async () => {
                const count = async (from: Date, to: Date) => { const [a] = await query<{
                    n: number;
                }>(Prisma.sql `WITH linked AS (SELECT "normalCustomerId" id,max("completedAt") last_at FROM "Booking" WHERE "normalCustomerId" IS NOT NULL AND status='COMPLETED' AND "completedAt">=${from} AND "completedAt"<${to} GROUP BY "normalCustomerId") SELECT count(*)::int n FROM linked x WHERE EXISTS(SELECT 1 FROM "Booking" p WHERE p."normalCustomerId"=x.id AND p.status='COMPLETED' AND p."completedAt"<x.last_at)`); return a.n; };
                const [a, b] = await Promise.all([count(r.from, r.to), count(r.previousFrom, r.previousTo)]);
                assign("returning", a, b);
            } });
    if (wants("newProfiles"))
        tasks.push({ ids: ["newProfiles"], run: async () => { const [a, b] = await Promise.all([prisma.normalCustomer.count({ where: { createdAt: { gte: r.from, lt: r.to } } }), prisma.normalCustomer.count({ where: { createdAt: { gte: r.previousFrom, lt: r.previousTo } } })]); assign("newProfiles", a, b); } });
    if (wants("predictions"))
        tasks.push({ ids: ["predictions"], run: async () => { const n = await prisma.customerBookingPrediction.count({ where: { modelVersion: BOOKING_PREDICTION_MODEL_VERSION, status: "PENDING", windowEndAt: { gt: now }, issuedAt: { lte: now } } }); assign("predictions", n, null, { snapshot: true }); } });
    if (wants("failed"))
        tasks.push({ ids: ["failed"], run: async () => { const [a, b] = await Promise.all([prisma.webhookEvent.count({ where: { receivedAt: { gte: r.from, lt: r.to }, status: "FAILED" } }), prisma.webhookEvent.count({ where: { receivedAt: { gte: r.previousFrom, lt: r.previousTo }, status: "FAILED" } })]); assign("failed", a, b); } });
    const outcomes = await Promise.allSettled(tasks.map(task => task.run()));
    outcomes.forEach((outcome, i) => { if (outcome.status === "rejected")
        for (const id of tasks[i].ids)
            metrics[id] = { value: null, previous: null, state: "UNAVAILABLE", detail: "This figure could not be loaded. Try Refresh." }; });
    return { period, ...range, generatedAt: now.toISOString(), metrics };
}
