import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingPriceDisplay } from "./booking-price-display";

test("booking history distinguishes missing prices from an explicitly recorded zero", () => {
  for (const value of [null, undefined, "", " ", "invalid", NaN, Infinity]) {
    assert.equal(bookingPriceDisplay(value), "Not available");
  }
  assert.equal(bookingPriceDisplay(0), "£0.00");
  assert.equal(bookingPriceDisplay("0.00"), "£0.00");
  assert.equal(bookingPriceDisplay("10.20"), "£10.20");
});
