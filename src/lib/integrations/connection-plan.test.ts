import { test } from "node:test";
import assert from "node:assert/strict";
import { createConnectionPlan, connectionOwnership } from "./connection-plan";

test("all source plans preserve the existing connection and require review", () => {
  for (const source of ["NEEDACABPLUS", "AUTOCAB", "LOCAL"]) {
    const plan = createConnectionPlan({ companyName: " Synthetic Company ", source, storage: "CURRENT_DATABASE" });
    assert.equal(plan.companyName, "Synthetic Company");
    assert.equal(plan.status, "DRAFT");
    assert.equal(plan.preserveExistingConnection, true);
    assert.equal(plan.businessTimezone, "Europe/London");
    assert.ok(plan.requirements.some(item => item.includes("booking writer")));
    assert.ok(plan.requirements.some(item => item.includes("provider + accountId")));
  }
});
test("direct Autocab requires ownership verification and separate storage needs approval", () => {
  const plan = createConnectionPlan({ companyName: "Synthetic", source: "AUTOCAB", storage: "DEDICATED_DATABASE" });
  assert.ok(plan.requirements.some(item => item.includes("exclusive booking ownership")));
  assert.ok(plan.requirements.some(item => item.includes("approved migration")));
});
test("reject invalid choices rather than creating an actionable plan", () => {
  for (const input of [
    { companyName: " ", source: "AUTOCAB", storage: "CURRENT_DATABASE" },
    { companyName: "x".repeat(121), source: "AUTOCAB", storage: "CURRENT_DATABASE" },
    { companyName: "Synthetic", source: "UNKNOWN", storage: "CURRENT_DATABASE" },
    { companyName: "Synthetic", source: "AUTOCAB", storage: "OTHER" },
  ]) assert.throws(() => createConnectionPlan(input));
});
test("runtime policy reflects exact cutover flags without inventing connection health", () => {
  assert.deepEqual(connectionOwnership({ BOOKING_WEBHOOK_WRITER: "NAC", AUTOCAB_WEBHOOKS_PAUSED: "true", DATABASE_SCHEMA_MANAGED_EXTERNALLY: "true" }), {
    bookingWriter: "NeedACabPlus", directIntakePaused: true, externallyManagedSchema: true,
  });
  assert.deepEqual(connectionOwnership({}), {
    bookingWriter: "TaxiCRM", directIntakePaused: false, externallyManagedSchema: false,
  });
});
