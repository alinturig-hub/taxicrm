import assert from "node:assert/strict";
import { test } from "node:test";
import { smsGatewayPreview } from "./sms-gateway-preview";

const configuration = {endpoint: "https://example.test/webhook?signature=synthetic-secret", phoneParameter: "customer_phone", messageParameter: "message", senderParameter: "sender", sender: "TaxiCRM"};
test("Orion-style request preview maps fields and never exposes signed query parameters", () => {
  const preview = smsGatewayPreview(configuration, "+44 7700 900123", "Synthetic preview");
  assert.deepEqual(preview.body, {customer_phone: "+447700900123", message: "Synthetic preview", sender: "TaxiCRM"});
  assert.equal(preview.endpoint, "https://example.test/webhook");
  assert.equal(preview.signedParametersPresent, true);
  assert.equal(preview.simulationOnly, true);
  assert.equal(JSON.stringify(preview).includes("synthetic-secret"), false);
});
test("invalid endpoints, recipient numbers and ambiguous parameters cannot produce a preview", () => {
  for (const endpoint of ["http://example.test", "https://user:pass@example.test", "https://example.test/#fragment"]) assert.throws(() => smsGatewayPreview({...configuration, endpoint}, "+447700900123", "Synthetic"));
  assert.throws(() => smsGatewayPreview(configuration, "123", "Synthetic"));
  assert.throws(() => smsGatewayPreview({...configuration, senderParameter: "message"}, "+447700900123", "Synthetic"));
  assert.throws(() => smsGatewayPreview({...configuration, phoneParameter: "constructor"}, "+447700900123", "Synthetic"));
});
