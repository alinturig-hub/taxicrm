/** Display the recorded price without substituting fare, cost or estimates. */
export function bookingPriceDisplay(value: number | string | null | undefined): string {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return "Not available";
  }
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not available";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}
