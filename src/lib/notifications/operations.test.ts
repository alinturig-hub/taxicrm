import assert from "node:assert/strict";
import {test} from "node:test";
import {encryptSecret} from "@/lib/security/encryption";
import {sendOrion, validateJob, planEvents, inactivityHours, checkInterval} from "./operations";
const config = {name: "Synthetic freephone", sourceField: "bookingSource", sourceValue: "synthetic", defaultRecipient: "+447700900000", sourceConfirmed: true, isEnabled: true, rules: [{event: "DAILY_REPORT", enabled: true, recipient: "", text: "{freephone}: {count}"}, {event: "NO_BOOKINGS", enabled: true, recipient: "", text: "No bookings"}, {event: "BELOW_THRESHOLD", enabled: true, recipient: "", text: "Below {threshold}", threshold: 5}]};
test("workflow activation requires a verified source and explicit event configuration", () => {
  assert.equal(validateJob(config).sourceField, "bookingSource");
  assert.throws(() => validateJob({...config, sourceField: "customerName"}));
  assert.throws(() => validateJob({...config, sourceField: "telephoneNumber", sourceValue: "not-a-number"}));
  assert.throws(() => validateJob({...config, sourceConfirmed: false}));
  assert.throws(() => validateJob({...config, defaultRecipient: "invalid"}));
  assert.throws(() => validateJob({...config, rules: [{...config.rules[2], threshold: undefined}]}));
});
test("data gaps suppress zero and threshold alerts, but reports expose incomplete counts", () => {
  const job = validateJob(config);
  const counts = {count: 0, known: 1, missingDate: 0, missingSource: 0, from: "", through: ""};
  assert.equal(planEvents(job, counts).length, 3);
  for (const extra of [{known: 0}, {missingDate: 1}, {missingSource: 1}, {futureDates: 1}]) {
    const events = planEvents(job, {...counts, ...extra});
    assert.equal(events.length, 1); assert.match(events[0].text, /Data incomplete/);
  }
});
test("Orion uses exact signed endpoint and JSON fields, without leaking provider errors", async () => {
  const gateway = {id: "default", endpoint: "https://orionconnect.co.uk/api/endpoint/webhook", signedParametersEncrypted: encryptSecret(`?endpoint_id=1&signature=${"a".repeat(64)}`), phoneParameter: "customer_phone", messageParameter: "message", senderParameter: "sender", sender: "TaxiCRM", isEnabled: true, createdAt: new Date(), updatedAt: new Date()};
  const transport: typeof fetch = async (input, init) => {
    assert.equal(new URL(String(input)).hostname, "orionconnect.co.uk");
    assert.deepEqual(JSON.parse(String(init?.body)), {customer_phone: "+447700900000", message: "Synthetic", sender: "TaxiCRM"});
    assert.equal(init?.redirect, "error");
    return new Response('{"success":true}', {status: 200});
  };
  assert.equal((await sendOrion(gateway, "+447700900000", "Synthetic", transport)).status, "ACCEPTED");
  for (const [response, status] of [[new Response('{"success":false,"error":"signature secret"}', {status: 200}), "FAILED"], [new Response("", {status: 400}), "FAILED"], [new Response("", {status: 503}), "UNCERTAIN"], [new Response("", {status: 429, headers: {"retry-after": "120"}}), "RETRY"]] as const) {
    const outcome = await sendOrion(gateway, "+447700900000", "Synthetic", async () => response);
    assert.equal(outcome.status, status); assert.ok(!JSON.stringify(outcome).includes("signature"));
  }
  assert.equal((await sendOrion(gateway, "+447700900000", "Synthetic", async () => {throw new Error("signed URL must never be exposed");})).status, "UNCERTAIN");
  assert.equal((await sendOrion(gateway, "+447700900000", "Synthetic", async () => new Response("x".repeat(20000)))).status, "UNCERTAIN");
});

test("12 hour window is explicit, validated and independent of daily reports", () => {
  const job = validateJob({...config, rules: [{...config.rules[1], windowHours: 12, text: "{count} bookings in {period}"}]});
  assert.equal(inactivityHours(job), 12); assert.equal(checkInterval(job), 60000);
  const daily = {count: 1, known: 1, missingDate: 0, missingSource: 0, from: "", through: ""};
  assert.equal(planEvents(job, daily, {...daily, count: 0})[0].text, "0 bookings in 12 hours");
  assert.equal(planEvents(job, daily, {...daily, count: 0, missingDate: 1}).length, 0);
  assert.throws(() => validateJob({...config, rules: [{...config.rules[1], windowHours: 6}]}));
  assert.equal(checkInterval(validateJob(config)), 86400000);
});
