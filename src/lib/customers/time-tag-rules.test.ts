import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTimeTagRules, defaultTimeTagRules } from "./time-tag-rules";
import { buildCustomerBehaviourTags } from "./customer-behaviour-tags";
const now = new Date("2026-11-10T12:00:00Z");
test("rejects invalid rules, collisions, excess and duplicate rule IDs", () => {
    assert.throws(() => parseTimeTagRules([{ ...defaultTimeTagRules[0], id: "WEEKEND_USER" }]));
    assert.throws(() => parseTimeTagRules([defaultTimeTagRules[0], defaultTimeTagRules[0]]));
    assert.throws(() => parseTimeTagRules([{ ...defaultTimeTagRules[0], minimumPercent: 101 }]));
    assert.throws(() => parseTimeTagRules(Array(21).fill(defaultTimeTagRules[0])));
});
test("configured time windows replace defaults; missing pickup and non-completed journeys are excluded", () => {
    const rows = ["COMPLETED", "COMPLETED", "COMPLETED", "CANCELLED", "NO_FARE"].map((status, i) => ({ status, pickupDueTime: new Date(`2026-11-0${9 - i}T09:30:00Z`), bookedAtTime: new Date(`2026-11-0${9 - i}T08:00:00Z`), locations: [] }));
    rows.push({ status: "COMPLETED", pickupDueTime: null as unknown as Date, bookedAtTime: new Date("2026-11-09T09:30:00Z"), locations: [] });
    const rule = { ...defaultTimeTagRules[0], start: "09:00", end: "10:00", name: "Morning commuter" };
    const tag = buildCustomerBehaviourTags(rows, now, [rule]).find(t => t.id === rule.id);
    assert.equal(tag?.label, "Morning commuter");
    assert.equal(tag?.evidenceCount, 3);
    assert.equal(tag?.eligibleCount, 3);
    assert.equal(tag?.lastObservedAt, "2026-11-09T09:30:00.000Z");
    assert.equal(buildCustomerBehaviourTags(rows, now, [{ ...rule, enabled: false }]).some(t => t.id === rule.id), false);
});
test("custom rules honour lookback longer than legacy fourteen days", () => {
    const rows = [1, 2, 3].map(i => ({ status: "COMPLETED", pickupDueTime: new Date(`2026-10-${10 + i}T08:30:00Z`), bookedAtTime: null, locations: [] }));
    const rule = { ...defaultTimeTagRules[0], id: "CUSTOM_TIME_COMMUTER", start: "09:00", end: "10:00", windowDays: 40 };
    assert.equal(buildCustomerBehaviourTags(rows, now, [rule]).find(t => t.id === rule.id)?.evidenceCount, 3);
});
