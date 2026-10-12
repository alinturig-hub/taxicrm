type IdentityBooking = {
  locations: Array<{
    type: "PICKUP" | "DESTINATION";
    address: string;
    zoneName: string | null;
  }>;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}

export function isSharedBookingPoint(bookings: IdentityBooking[]) {
  if (bookings.length < 20) return false;

  const pickupCounts = new Map<string, number>();
  const destinations = new Set<string>();
  for (const booking of bookings) {
    for (const location of booking.locations) {
      if (location.type === "PICKUP") {
        const key = normalize(location.zoneName || location.address);
        if (key) pickupCounts.set(key, (pickupCounts.get(key) ?? 0) + 1);
      } else if (location.type === "DESTINATION") {
        const key = normalize(location.address);
        if (key) destinations.add(key);
      }
    }
  }

  const topPickupCount = Math.max(0, ...Array.from(pickupCounts.values()));
  return topPickupCount / bookings.length >= 0.6 && destinations.size >= 10;
}
