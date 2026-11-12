import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionDurationSeconds } from "./session-duration";
import { startOfLondonDay, addLondonDays } from "@/lib/time/london-calendar";
test("London daylight-saving day clips and merges overlapping sessions without counting future time", () => {
 const from = startOfLondonDay(new Date("2026-03-29T12:00:00Z")), to = addLondonDays(from, 1);
 assert.equal((to.getTime() - from.getTime()) / 3600000, 23);
 const t = (hours: number) => new Date(from.getTime() + hours * 3600000);
 assert.equal(sessionDurationSeconds([{startedAt:t(-1),endedAt:t(2)},{startedAt:t(1),endedAt:t(3)},{startedAt:t(5),endedAt:null}], from, to, t(7)), 5 * 3600);
});
