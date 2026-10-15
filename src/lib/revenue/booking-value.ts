/** Preserve unknown values and signed amounts; never substitute fare or tariffs. */
export function recordedAmount(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "boolean" || Array.isArray(value) || (typeof value === "string" && !value.trim())) return null;
  try { const amount = Number(value); return Number.isFinite(amount) ? amount : null; }
  catch { return null; }
}
export function bookingValue(booking: { price?: unknown; cost?: unknown }): number | null {
  const amounts = [recordedAmount(booking.price), recordedAmount(booking.cost)].filter((amount): amount is number => amount !== null);
  return amounts.length ? Math.max(...amounts) : null;
}
