import assert from "node:assert/strict";
import { test } from "node:test";
import { assertJobSucceeded, historicalBackfillEnabled } from "./scheduler-result.mjs";

test("historical Geoapify backfill requires an explicit opt-in", () => {
  for (const value of [undefined, "", "false", "1", "TRUE"]) assert.equal(historicalBackfillEnabled({ENABLE_HISTORICAL_GEOAPIFY_BACKFILL: value}), false);
  assert.equal(historicalBackfillEnabled({ENABLE_HISTORICAL_GEOAPIFY_BACKFILL: "true"}), true);
});

test("HTTP 200 partial job failures stop draining rather than repeating failed customers", () => {
  assert.throws(() => assertJobSucceeded({ok: true, status: 200}, {success: false, hasMore: true}), /unsuccessful/);
  assert.throws(() => assertJobSucceeded({ok: false, status: 500}, {error: "synthetic"}), /synthetic/);
  assert.doesNotThrow(() => assertJobSucceeded({ok: true, status: 200}, {success: true, hasMore: true}));
});
