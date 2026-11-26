export const automationScheduleMinutes = Object.freeze({
  CUSTOMER_PROFILE_SNAPSHOTS: 360,
  BOOKING_DEMAND_FORECAST: 720,
  CUSTOMER_BOOKING_PREDICTIONS: 360,
  HISTORICAL_GEOAPIFY_BACKFILL: 360,
});

/** @param {Record<string, string | undefined>} environment */
export function historicalBackfillEnabled(environment = process.env) {
  return environment.ENABLE_HISTORICAL_GEOAPIFY_BACKFILL === "true";
}

export function assertJobSucceeded(response, payload) {
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.error || `HTTP ${response.status}: job unsuccessful`);
  }
}
