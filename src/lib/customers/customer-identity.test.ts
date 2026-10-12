import assert from "node:assert/strict";
import { isSharedBookingPoint } from "./customer-identity";

const shared = Array.from({ length: 20 }, (_, index) => ({
  locations: [
    { type: "PICKUP" as const, address: `${index} Office Road`, zoneName: index < 12 ? "Central" : "North" },
    { type: "DESTINATION" as const, address: `${index % 12} Destination Road`, zoneName: null },
  ],
}));

assert.equal(isSharedBookingPoint(shared), true);
assert.equal(isSharedBookingPoint(shared.slice(0, 19)), false);
assert.equal(isSharedBookingPoint(shared.map((booking, index) => ({
  locations: booking.locations.map((location) => location.type === "PICKUP"
    ? { ...location, zoneName: `Zone ${index}` }
    : location),
}))), false);

console.log("Customer identity tests passed.");
