import { addLondonDays, londonDateKey } from "@/lib/time/london-calendar";

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Previous London calendar day at the same wall-clock time.
 * Repeated autumn hours use the first occurrence; a missing spring hour shifts
 * forward by the gap. Never subtract a fixed 24 hours across DST.
 */
export function yesterdayAtLondonClock(now: Date) {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Invalid comparison date");
  const parts = clock.formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const previous = londonDateKey(addLondonDays(now, -1));
  const wall =
    previous.getTime() +
    value("hour") * 3600000 +
    value("minute") * 60000 +
    value("second") * 1000 +
    now.getUTCMilliseconds();
  const expected = clock.format(now);
  const candidates = [new Date(wall - 3600000), new Date(wall)];
  return (
    candidates.find(
      (candidate) =>
        clock.format(candidate) === expected &&
        londonDateKey(candidate).getTime() === previous.getTime(),
    ) ?? new Date(wall)
  );
}

export function comparisonDelta(current: number, previous: number) {
  const delta = Number((current - previous).toFixed(2));
  return {
    delta,
    percent:
      previous === 0 ? null : Number(((delta / previous) * 100).toFixed(1)),
  };
}
