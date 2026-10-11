import assert from "node:assert/strict";
import { test } from "node:test";
import { apiRecords } from "./store";
import { signApiPreview, verifyApiPreview } from "./preview";

test("generic records preserve zones of every company and status, stable zero IDs and nested JSON", () => {
  const payload = [{id: 0, companyId: 2, active: false, polygon: [[1, 2]]}, {id: "001", name: "Synthetic zone"}];
  assert.deepEqual(apiRecords(payload, "id"), payload.map(data => ({externalId: String(data.id), data})));
  assert.throws(() => apiRecords([{id: 1}, {name: "missing"}], "id"), /valid id/);
  assert.throws(() => apiRecords([{id: 1}, {id: "1"}], "id"), /Duplicate/);
  for (const payload of [{zones: []}, ["synthetic"], null, false, 0]) {
    assert.deepEqual(apiRecords(payload, null), [{externalId: "$response", data: payload}]);
  }
});

test("saving uses the signed preview, rejects altered responses, URLs and expired previews", () => {
  const original = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = "synthetic-preview-secret-not-for-use";
  try {
    const url = "https://example.test/zones", data = [{id: 1}], now = 1000000;
    const token = signApiPreview(url, data, now);
    assert.doesNotThrow(() => verifyApiPreview(url, data, token, now));
    assert.throws(() => verifyApiPreview(url, [{id: 2}], token, now), /changed/);
    assert.throws(() => verifyApiPreview(url + "2", data, token, now), /changed/);
    assert.throws(() => verifyApiPreview(url, data, token, now + 16 * 60000), /expired/);
  } finally { if (original === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = original; }
});
