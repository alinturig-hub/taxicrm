import type { ProfileBooking } from "./customer-profiler";
// Descriptive evidence only. No booking probability or inferred personal intention.
export function customerObservations(bookings: ProfileBooking[], now = new Date()) {
  const seen = new Set<string>();
  let duplicateReferences = 0, missingPickup = 0, futurePickup = 0;
  const dates: Date[] = [];
  for (const b of bookings) {
    const key = JSON.stringify([b.provider ?? "UNSPECIFIED", b.externalId]);
    if (seen.has(key)) { duplicateReferences++; continue; } seen.add(key);
    if (b.status !== "COMPLETED") continue;
    if (!b.pickupDueTime || !Number.isFinite(b.pickupDueTime.getTime())) { missingPickup++; continue; }
    if (b.pickupDueTime > now) { futurePickup++; continue; }
    dates.push(b.pickupDueTime);
  }
  dates.sort((a, b) => a.getTime() - b.getTime());
  const intervals = dates.slice(1).map((d, i) => (d.getTime() - dates[i].getTime()) / 3600000).filter(v => v > 0).sort((a, b) => a - b);
  const median = intervals.length ? (intervals[Math.floor((intervals.length - 1) / 2)] + intervals[Math.floor(intervals.length / 2)]) / 2 : null;
  const countWindow = (start: number, end: number) => dates.filter(d => d.getTime() >= start && d.getTime() < end).length;
  const recent = countWindow(now.getTime() - 30 * 86400000, now.getTime() + 1), previous = countWindow(now.getTime() - 60 * 86400000, now.getTime() - 30 * 86400000);
  const hours = new Map<string, number>();
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", hour: "2-digit", hourCycle: "h23" });
  dates.forEach(d => { const p = fmt.formatToParts(d); const k = `${p.find(x => x.type === "weekday")?.value} ${p.find(x => x.type === "hour")?.value}:00`; hours.set(k, (hours.get(k) ?? 0) + 1); });
  return { completedWithPickup: dates.length, missingPickup, futurePickup, duplicateReferences, daysSinceLastCompletedPickup: dates.length ? (now.getTime() - dates[dates.length - 1].getTime()) / 86400000 : null,
    medianIntervalHours: median, positiveIntervals: intervals.length, recent30Days: recent, previous30Days: previous,
    activityChangePercent: previous ? (recent - previous) / previous * 100 : null,
    frequentLondonSlots: Array.from(hours).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([slot, count]) => ({ slot, count })),
    status: intervals.length >= 4 ? "OBSERVED_HISTORY" : "INSUFFICIENT_HISTORY",
    method: "Completed pickups only; trailing 30-day windows use elapsed UTC time. Slots use Europe/London. Zero-length intervals excluded. Observations are not a calibrated prediction or evidence of customer intent." };
}
