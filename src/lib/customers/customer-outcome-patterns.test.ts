import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOutcomePatterns, outcomePatternsForProfile, type OutcomeJourney } from "./customer-outcome-patterns";
const dt = (v: string) => new Date(`2026-11-09T${v}:00Z`);
const now = dt("18:00");
const row = (id: string, status: string, extra: Partial<OutcomeJourney> = {}): OutcomeJourney => ({ id, status, bookedAtTime: dt("10:00"), pickupDueTime: dt("11:00"), dispatchedAt: null, completedAt: null, cancelledAt: null, noFareAt: null, ...extra });
test("summarises separate outcomes and uses only valid timing pairs", () => {
 const result = buildOutcomePatterns([row("a", "COMPLETED", {completedAt:dt("11:30")}), row("b", "CANCELLED", {dispatchedAt:dt("10:10"),cancelledAt:dt("10:30")}), row("c", "CANCELLED", {cancelledAt:dt("11:10")}), row("d", "NO_FARE", {noFareAt:dt("11:15")}), row("e", "REJECTED"), row("f", "NO_FARE", {bookedAtTime:null}), row("g", "CANCELLED", {cancelledAt:dt("19:00")})], now);
 assert.deepEqual([result.completed,result.cancelled,result.noFare,result.total],[1,2,1,4]);
 assert.equal(result.cancellationPercent,50); assert.equal(result.noFarePercent,25);
 assert.equal(result.afterBookingMedianMinutes,50); assert.equal(result.afterBookingSamples,2);
 assert.equal(result.afterDispatchMedianMinutes,20); assert.equal(result.afterDispatchSamples,1);
 assert.equal(result.beforePickupMedianMinutes,30); assert.equal(result.cancellationAfterPickupCount,1);
 assert.equal(result.undatedExcluded,1); assert.equal(result.futureExcluded,1);
});
test("missing timestamps stay unknown, not zero; empty history has no percentage", () => {
 const result=buildOutcomePatterns([row("a","CANCELLED")],now);
 assert.equal(result.afterBookingMedianMinutes,null);assert.equal(result.afterBookingSamples,0);
 assert.equal(buildOutcomePatterns([],now).noFarePercent,null);
});
test("shared identities are not individually profiled and duplicates fail closed", () => {
 assert.equal(outcomePatternsForProfile([row("a","NO_FARE")],"SHARED_BOOKING_POINT",now),null);
 assert.throws(()=>buildOutcomePatterns([row("a","NO_FARE"),row("a","NO_FARE")],now),/unique/);
});
test("inconsistent event ordering cannot create a timing pattern", () => {
 const result=buildOutcomePatterns([row("a","CANCELLED",{bookedAtTime:dt("10:30"),dispatchedAt:dt("10:40"),cancelledAt:dt("10:20")})],now);
 assert.equal(result.cancelled,1);
 assert.equal(result.afterBookingMedianMinutes,null);
 assert.equal(result.afterDispatchMedianMinutes,null);
 assert.equal(result.beforePickupMedianMinutes,null);
});
