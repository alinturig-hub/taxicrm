import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateTimeTag, validateTimeTagRule, type TimeTagJourney } from "./configurable-time-tag";
const now = new Date("2026-11-10T12:00:00Z");
const rule = {name:"Morning",start:"04:00",end:"08:00",windowDays:14,minimumMatches:3,minimumPercent:40};
const j = (id:string, date:string|null, status="COMPLETED"):TimeTagJourney => ({id,status,pickupDueTime:date ? new Date(date) : null});
test("evaluates London time, thresholds, boundaries and exclusions",()=>{
 const rows=[j("1","2026-11-09T04:00:00Z"),j("2","2026-11-09T07:59:00Z"),j("3","2026-11-08T05:00:00Z"),j("4","2026-11-09T08:00:00Z"),j("5","2026-11-09T04:30:00Z","CANCELLED"),j("6",null),j("7","2026-11-11T04:30:00Z")];
 const r=evaluateTimeTag(rule,rows,now);assert.equal(r.eligible,4);assert.equal(r.matched,3);assert.equal(r.percent,75);assert.equal(r.missingPickup,1);assert.equal(r.qualifies,true);
});
test("handles overnight intervals and London summer time",()=>{
 const night={...rule,name:"Night",start:"22:00",end:"04:00",minimumMatches:2};
 const r=evaluateTimeTag(night,[j("1","2026-11-09T23:00:00Z"),j("2","2026-11-10T03:59:00Z"),j("3","2026-11-10T04:00:00Z")],now);assert.equal(r.matched,2);assert.equal(r.qualifies,true);
 const summer=evaluateTimeTag(rule,[j("a","2026-07-01T03:00:00Z")],new Date("2026-07-02T12:00:00Z"));assert.equal(summer.matched,1);
 const clockChange=evaluateTimeTag(night,[j("a","2026-10-25T00:30:00Z"),j("b","2026-10-25T01:30:00Z")],new Date("2026-10-26T12:00:00Z"));assert.equal(clockChange.matched,2);
});
test("rejects invalid rules and duplicate journeys",()=>{
 assert.ok(validateTimeTagRule({...rule,start:"08:00",end:"08:00"}).length);assert.ok(validateTimeTagRule({...rule,start:"25:00"}).length);assert.ok(validateTimeTagRule({...rule,minimumPercent:101}).length);assert.throws(()=>evaluateTimeTag(rule,[j("a",null),j("a",null)],now),/unique/);
});
