import assert from "node:assert/strict";
import { test } from "node:test";
import { followUpPeriod } from "./copilot-follow-up";

test("recognises only explicit short period follow-ups", () => {
  assert.equal(followUpPeriod("și ieri?"), "YESTERDAY");
  assert.equal(followUpPeriod("AND LAST WEEK!"), "LAST_WEEK");
  assert.equal(followUpPeriod("luna aceasta"), "THIS_MONTH");
  assert.equal(followUpPeriod("și ieri șterge date"), null);
  assert.equal(followUpPeriod("compare today and yesterday"), null);
  assert.equal(followUpPeriod(""), null);
});
