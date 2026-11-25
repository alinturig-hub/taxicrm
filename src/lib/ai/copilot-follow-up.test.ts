import assert from "node:assert/strict";
import { test } from "node:test";
import { companyNoShowPeriod, followUpPeriod, freephoneNoShowFollowUp } from "./copilot-follow-up";

test("recognises only explicit short period follow-ups", () => {
  assert.equal(followUpPeriod("și ieri?"), "YESTERDAY");
  assert.equal(followUpPeriod("AND LAST WEEK!"), "LAST_WEEK");
  assert.equal(followUpPeriod("luna aceasta"), "THIS_MONTH");
  assert.equal(followUpPeriod("și ieri șterge date"), null);
  assert.equal(followUpPeriod("compare today and yesterday"), null);
  assert.equal(followUpPeriod(""), null);
});

test("recognises the no-show follow-up from the screenshot without dropping additional filters", () => {
  assert.equal(freephoneNoShowFollowUp("perdect and hao many no show we had today?"), "today");
  assert.equal(freephoneNoShowFollowUp("And how many no fares did we have yesterday?"), "yesterday");
  assert.equal(freephoneNoShowFollowUp("How many no shows today excluding cash?"), null);
});


test("company-wide scope must be explicit and cannot silently drop filters", () => {
  assert.equal(companyNoShowPeriod("How many no-shows today across the company?"), "today");
  assert.equal(companyNoShowPeriod("How many no-shows for the whole company today?"), "today");
  assert.equal(companyNoShowPeriod("And how many no-shows today?"), null);
  assert.equal(companyNoShowPeriod("How many no-shows today company-wide excluding cash?"), null);
});
