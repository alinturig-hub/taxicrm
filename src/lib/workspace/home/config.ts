import { startOfLondonDay, addLondonDays } from "@/lib/time/london-calendar";
import { yesterdayAtLondonClock } from "@/lib/today/comparison";
export const periods = ["TODAY", "YESTERDAY", "LAST7", "LAST30"] as const;
export type WorkspacePeriod = typeof periods[number];
export const focuses = ["OWNER", "MARKETING", "OPERATIONS", "TECHNICAL"] as const;
export type WorkspaceFocus = typeof focuses[number];
export const cards = {
    revenue: { label: "Gross receipts", permission: "revenue.view", href: "/dashboard/analytics", unit: "GBP", note: "Recorded Price from COMPLETED journeys finished in the selected period. Missing prices make this a partial amount." },
    margin: { label: "Margin before expenses", permission: "revenue.view", href: "/dashboard/analytics", unit: "GBP", note: "COMPLETED Price minus Cost. This is not net profit. Unavailable when a completed journey is missing Price or Cost." },
    booked: { label: "Bookings received", permission: "bookings.view", href: "/dashboard/bookings", unit: "COUNT", note: "Booking actions recorded in the selected period, including bookings for later pickup dates." },
    pickups: { label: "Pickups scheduled", permission: "bookings.view", href: "/dashboard/bookings", unit: "COUNT", note: "Pickup dates fall in the selected London calendar days. Includes future pickups today and all statuses." },
    completed: { label: "Journeys completed", permission: "bookings.view", href: "/dashboard/bookings", unit: "COUNT", note: "Current COMPLETED journeys with a recorded completion time in the selected period." },
    cancelled: { label: "Cancellations", permission: "bookings.view", href: "/dashboard/bookings", unit: "COUNT", note: "Recorded cancellation events in the selected period. Counts alone do not establish who was responsible." },
    noFare: { label: "No-fare events", permission: "bookings.view", href: "/dashboard/bookings", unit: "COUNT", note: "Recorded no-fare events in the selected period, including the NO_FARE and NOFARE source aliases." },
    returning: { label: "Returning booking profiles", permission: "customers.view", href: "/dashboard/customers", unit: "COUNT", note: "Linked profiles completing a repeat journey in this period, including repeats within the same period. Shared contact points may be included; this is not a loyalty or retention rate." },
    newProfiles: { label: "New contact profiles", permission: "customers.view", href: "/dashboard/customers", unit: "COUNT", note: "CRM contact profiles created in this period, not necessarily first-time passengers." },
    predictions: { label: "Upcoming customer signals", permission: "intelligence.view", href: "/dashboard/ai/predictions", unit: "COUNT", note: "Current pending FREQUENCY_REFERENCE_V1 signals. This is a snapshot now, independent of the period selector; signals are not calibrated probabilities or permission to contact customers." },
    retention: { label: "Retention review", permission: "customers.view", href: "/dashboard/customers", unit: "ACTION", note: "Open a customer profile to review completed-journey retention progress, cancellations and no-fare history. No population retention rate is inferred by this card." },
    campaigns: { label: "Marketing campaigns", permission: "customers.view", href: "/dashboard/marketing/whatsapp", unit: "ACTION", note: "Review campaign plans and available results. No delivered-message, eligibility or revenue-attribution figure is inferred from navigation access." },
    failed: { label: "Processing failures", permission: "integrations.view", href: "/dashboard/integrations/needacabplus", unit: "COUNT", note: "Events received in the selected period still marked FAILED. This does not prove a customer-facing outage." },
} as const;
export type WorkspaceCard = keyof typeof cards;
export type WorkspaceConfig = {
    focus: WorkspaceFocus;
    period: WorkspacePeriod;
    widgets: WorkspaceCard[];
};
export type Can = (permission: string) => boolean;
export function allowedCards(can: Can) {
    return (Object.keys(cards) as WorkspaceCard[]).filter(id => can(cards[id].permission) && (id !== "returning" || can("bookings.view")) && (!["revenue","margin"].includes(id) || can("reports.view")));
}
export const presets: Record<WorkspaceFocus, WorkspaceCard[]> = {
    OWNER: ["revenue", "margin", "completed", "returning"],
    MARKETING: ["campaigns", "newProfiles", "returning", "predictions"],
    OPERATIONS: ["booked", "pickups", "completed", "cancelled", "noFare"],
    TECHNICAL: ["failed", "booked", "completed"],
};
export function defaultConfig(can: Can): WorkspaceConfig {
    const allowed = allowedCards(can);
    const focus: WorkspaceFocus = can("revenue.view") && can("reports.view") ? "OWNER" : can("bookings.view") ? "OPERATIONS" : can("customers.view") ? "MARKETING" : "TECHNICAL";
    return { focus, period: "TODAY", widgets: presets[focus].filter(id => allowed.includes(id)) };
}
export function parseConfig(input: unknown, allowed: WorkspaceCard[]): WorkspaceConfig {
    if (!input || typeof input !== "object" || Array.isArray(input))
        throw Error("Invalid workspace layout.");
    const x = input as Record<string, unknown>;
    if (Object.keys(x).some(k => !["focus", "period", "widgets"].includes(k)) || !focuses.includes(x.focus as WorkspaceFocus) || !periods.includes(x.period as WorkspacePeriod) || !Array.isArray(x.widgets) || x.widgets.length > Object.keys(cards).length)
        throw Error("Invalid workspace layout.");
    const widgets = x.widgets as unknown[];
    if (widgets.some(id => typeof id !== "string" || !allowed.includes(id as WorkspaceCard)) || new Set(widgets).size !== widgets.length)
        throw Error("Choose distinct cards allowed by your access.");
    return { focus: x.focus as WorkspaceFocus, period: x.period as WorkspacePeriod, widgets: widgets as WorkspaceCard[] };
}
export function visibleConfig(input: unknown, can: Can): WorkspaceConfig {
    try {
        const raw = parseConfig(input, Object.keys(cards) as WorkspaceCard[]);
        return { ...raw, widgets: raw.widgets.filter(id => allowedCards(can).includes(id)) };
    }
    catch {
        return defaultConfig(can);
    }
}
function shiftWall(date: Date, days: number) { let d = date; for (let i = 0; i < days; i++)
    d = yesterdayAtLondonClock(d); return d; }
export function workspaceRange(period: WorkspacePeriod, now = new Date()) {
    if (!Number.isFinite(now.getTime()))
        throw Error("Invalid time");
    const midnight = startOfLondonDay(now), days = period === "LAST7" ? 7 : period === "LAST30" ? 30 : 1;
    const from = period === "YESTERDAY" ? addLondonDays(midnight, -1) : addLondonDays(midnight, 1 - days);
    const to = period === "YESTERDAY" ? midnight : now;
    const scheduledTo = period === "YESTERDAY" ? midnight : addLondonDays(midnight, 1);
    const previousFrom = addLondonDays(from, -days), previousTo = period === "YESTERDAY" ? from : shiftWall(now, days);
    return { from, to, scheduledTo, previousFrom, previousTo, previousScheduledTo: addLondonDays(scheduledTo, -days) };
}
