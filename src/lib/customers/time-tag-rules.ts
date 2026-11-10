import { validateTimeTagRule, type TimeTagRule } from "./configurable-time-tag";
export type SavedTimeTagRule = TimeTagRule & {
    id: string;
    enabled: boolean;
};
export const defaultTimeTagRules: SavedTimeTagRule[] = [
    { id: "EARLY_MORNING_USER", name: "Early Morning User", start: "04:00", end: "08:00", windowDays: 14, minimumMatches: 3, minimumPercent: 40, enabled: true },
    { id: "LATE_EVENING_USER", name: "Late Evening User", start: "22:00", end: "04:00", windowDays: 14, minimumMatches: 3, minimumPercent: 40, enabled: true },
];
export function parseTimeTagRules(value: unknown): SavedTimeTagRule[] {
    if (!Array.isArray(value) || value.length > 20)
        throw Error("Use at most 20 time rules.");
    const ids = new Set<string>();
    return value.map(raw => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
            throw Error("Invalid rule.");
        const r = raw as Record<string, unknown>;
        const keys = ["id", "name", "start", "end", "windowDays", "minimumMatches", "minimumPercent", "enabled"];
        if (Object.keys(r).some(k => !keys.includes(k)) || typeof r.id !== "string" || !(r.id === "EARLY_MORNING_USER" || r.id === "LATE_EVENING_USER" || /^CUSTOM_TIME_[A-Z0-9_]{1,50}$/.test(r.id)) || ids.has(r.id) || typeof r.enabled !== "boolean" || typeof r.name !== "string" || typeof r.start !== "string" || typeof r.end !== "string" || typeof r.windowDays !== "number" || typeof r.minimumMatches !== "number" || typeof r.minimumPercent !== "number")
            throw Error("Invalid rule or duplicate ID.");
        const rule = r as SavedTimeTagRule;
        const errors = validateTimeTagRule(rule);
        if (errors.length)
            throw Error(errors.join(" "));
        ids.add(rule.id);
        return { ...rule, name: rule.name.trim() };
    });
}
