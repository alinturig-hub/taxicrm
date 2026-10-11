import assert from "node:assert/strict";
import {test} from "node:test";
import {normaliseFreephoneNumber} from "./phone-audit";
test("UK freephone line matching preserves landlines and normalises national/international formats", () => {
  for (const phone of ["07700 900000", "+44 (7700) 900000", "0044-7700-900000"]) assert.equal(normaliseFreephoneNumber(phone), "07700900000");
  assert.equal(normaliseFreephoneNumber("+44 1632 960000"), "01632960000");
  for (const phone of ["", "123", "+1 7700900000", "number 07700900000", "07700900000 ext 1"]) assert.throws(() => normaliseFreephoneNumber(phone));
});
