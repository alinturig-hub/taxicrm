/** TaxiCRM remains the webhook inbox when Need A Cab Plus owns canonical bookings. */
export function bookingEventsOwnedByNeedACabPlus(): boolean {
  return process.env.BOOKING_WEBHOOK_WRITER === "NAC";
}

export function shouldProcessWebhookLocally(eventType: string): boolean {
  return !bookingEventsOwnedByNeedACabPlus() || !/^booking/i.test(eventType);
}
