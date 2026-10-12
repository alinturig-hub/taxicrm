import test from "node:test";
import assert from "node:assert/strict";
import { providerInput, publicProvider } from "./webhook-providers";
const draft = {
  name: "Synthetic Autocab source",
  baseUrl: "https://example.test/api/webhooks/autocab/",
  apiKeyHeader: "x-test-key",
  isEnabled: false,
  apiKey: "",
};
test("provider updates preserve a blank key and reject unsafe URLs and headers", () => {
  const data = providerInput(draft, true);
  assert.equal(data.baseUrl, "https://example.test/api/webhooks/autocab");
  assert.equal("apiKeyEncrypted" in data, false);
  for (const baseUrl of [
    "http://example.test",
    "https://user:password@example.test",
    "https://example.test?secret=x",
    "https://example.test#x",
  ]) {
    assert.throws(() => providerInput({ ...draft, baseUrl }, true));
  }
  for (const apiKeyHeader of [
    "cookie",
    "authorization",
    "host",
    "content-type",
    "bad header",
  ]) {
    assert.throws(() => providerInput({ ...draft, apiKeyHeader }, true));
  }
  assert.throws(() => providerInput(draft));
});
test("public provider responses expose only key presence", () => {
  const result = publicProvider({
    id: "synthetic",
    name: "Synthetic",
    description: null,
    baseUrl: draft.baseUrl,
    apiKeyHeader: draft.apiKeyHeader,
    isEnabled: false,
    apiKeyEncrypted: "synthetic-encrypted-value",
  });
  assert.equal(result.hasApiKey, true);
  assert.equal(
    JSON.stringify(result).includes("synthetic-encrypted-value"),
    false,
  );
});
