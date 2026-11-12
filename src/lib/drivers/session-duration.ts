export type SessionInterval = { startedAt: Date; endedAt: Date | null };
// Bound every recorded interval to the requested London day and to now. A gap
// is unobserved time, not a verified break; overlapping records count once.
export function sessionDurationSeconds(sessions: SessionInterval[], from: Date, to: Date, now: Date) {
 const upper = Math.min(to.getTime(), now.getTime());
 const ranges = sessions.map(s => [Math.max(s.startedAt.getTime(), from.getTime()), Math.min(s.endedAt?.getTime() ?? now.getTime(), upper)] as const)
  .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start).sort((a, b) => a[0] - b[0]);
 let total = 0, start: number | undefined, end = 0;
 for (const [nextStart, nextEnd] of ranges) {
  if (start === undefined) { start = nextStart; end = nextEnd; }
  else if (nextStart <= end) end = Math.max(end, nextEnd);
  else { total += end - start; start = nextStart; end = nextEnd; }
 }
 if (start !== undefined) total += end - start;
 return Math.floor(total / 1000);
}
