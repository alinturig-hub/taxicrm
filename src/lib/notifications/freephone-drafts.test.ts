import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFreephoneEntries } from "./freephone-drafts";
import { bookingEvidenceReadiness } from "./readiness";
test("draft entries normalise verified line numbers and reject ambiguous or oversized batches", () => {
  assert.deepEqual(
    validateFreephoneEntries([
      { name: " Synthetic line ", phone: "+44 7700 900044", isEnabled: true },
    ]),
    [{ name: "Synthetic line", phone: "07700900044" }],
  );
  assert.throws(() =>
    validateFreephoneEntries([
      { name: "A", phone: "07700900044" },
      { name: "B", phone: "+447700900044" },
    ]),
  );
  assert.throws(() =>
    validateFreephoneEntries(
      Array(26).fill({ name: "A", phone: "07700900044" }),
    ),
  );
  assert.throws(() =>
    validateFreephoneEntries([{ name: "", phone: "07700900044" }]),
  );
});
test("activation evidence distinguishes a known complete line from missing, unidentified or future evidence", () => {
  const complete = {
    known: 1,
    missingDate: 0,
    missingSource: 0,
    futureDates: 0,
  };
  assert.equal(bookingEvidenceReadiness(complete).ready, true);
  for (const extra of [
    { known: 0 },
    { missingDate: 1 },
    { missingSource: 1 },
    { futureDates: 1 },
  ]) {
    const state = bookingEvidenceReadiness({ ...complete, ...extra });
    assert.equal(state.ready, false);
    assert.ok(state.blockers.length);
  }
});
