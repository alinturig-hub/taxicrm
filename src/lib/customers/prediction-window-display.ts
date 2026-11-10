type Instant = string | Date | null | undefined;

/** Presentation only: never changes stored forecasts, scores or outcome evidence. */
export function boundedPredictionDisplay(start: Instant, end: Instant, forecastStart: Instant, forecastEnd: Instant) {
  const times = [start, end, forecastStart, forecastEnd].map((value) => value instanceof Date ? value.getTime() : value ? Date.parse(value) : NaN);
  if (times.some((time) => !Number.isFinite(time)) || times[0] >= times[1] || times[2] >= times[3]) return null;
  const lower = Math.max(times[0], times[2]);
  const upper = Math.min(times[1], times[3]);
  return lower < upper ? { startAt: new Date(lower).toISOString(), endAt: new Date(upper).toISOString() } : null;
}
