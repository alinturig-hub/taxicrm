import assert from "node:assert/strict";
import { test } from "node:test";
import { countFreephoneBookings, previewFreephoneWorkflow, type FreephoneWorkflow } from "./freephone-workflow-preview";

const workflow: FreephoneWorkflow = {name: "Synthetic Hospital Freephone", defaultRecipient: "+447700900123", rules: [
  {event: "DAILY_REPORT", enabled: true, recipient: "", text: "{freephone}: {count} in {period}"},
  {event: "NO_BOOKINGS", enabled: true, recipient: "+447700900124", text: "No bookings for {freephone}"},
  {event: "BELOW_THRESHOLD", enabled: true, recipient: "", threshold: 3, text: "{count} below {threshold}"},
]};
test("all three independent rules retain event text and inherited or specific recipients", () => {
  const empty = previewFreephoneWorkflow(workflow, 0);
  assert.ok(empty.every(event => event.triggered && event.simulationOnly));
  assert.equal(empty[0].recipient, workflow.defaultRecipient); assert.equal(empty[1].recipient, "+447700900124");
  assert.equal(empty[2].text, "0 below 3");
  assert.deepEqual(previewFreephoneWorkflow(workflow, 3).map(event => event.triggered), [true, false, false]);
  assert.throws(() => previewFreephoneWorkflow({...workflow, defaultRecipient: ""}, 1));
  assert.throws(() => previewFreephoneWorkflow({...workflow, rules: [{...workflow.rules[2], threshold: undefined}]}, 1));
  assert.throws(() => previewFreephoneWorkflow({...workflow, rules: [{...workflow.rules[0], text: "{unknown}"}]}, 1));
});
test("verified freephone names and rolling 24 hours exclude future, unrelated and missing data across London DST", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const result = countFreephoneBookings(workflow.name, [
    {sourceName: workflow.name, bookedAt: new Date("2026-10-24T12:00:00Z")},
    {sourceName: workflow.name, bookedAt: new Date("2026-10-24T12:00:01Z")},
    {sourceName: workflow.name, bookedAt: now},
    {sourceName: workflow.name, bookedAt: new Date("2026-10-25T12:00:01Z")},
    {sourceName: "Another source", bookedAt: now},
    {sourceName: null, bookedAt: now},
    {sourceName: workflow.name, bookedAt: null},
  ], now);
  assert.equal(result.count, 2); assert.equal(result.missingSource, 1); assert.equal(result.missingDate, 1);
  assert.equal(now.getTime() - result.from.getTime(), 24 * 60 * 60 * 1000);
});
