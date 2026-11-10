export type TimeTagRule = {
  name: string;
  start: string;
  end: string;
  windowDays: number;
  minimumMatches: number;
  minimumPercent: number;
};
export type TimeTagJourney = { id: string; status: string; pickupDueTime: Date | null };

function parseTime(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
export function validateTimeTagRule(rule: TimeTagRule): string[] {
  const errors: string[] = [];
  if (!rule.name.trim() || rule.name.trim().length > 60) errors.push("Name must be between 1 and 60 characters.");
  const start = parseTime(rule.start), end = parseTime(rule.end);
  if (start === null || end === null) errors.push("Use valid times in HH:MM format.");
  else if (start === end) errors.push("Start and end must differ.");
  if (!Number.isInteger(rule.windowDays) || rule.windowDays < 1 || rule.windowDays > 90) errors.push("The lookback must be 1–90 days.");
  if (!Number.isInteger(rule.minimumMatches) || rule.minimumMatches < 1 || rule.minimumMatches > 1000) errors.push("Minimum matches must be 1–1000.");
  if (!Number.isFinite(rule.minimumPercent) || rule.minimumPercent < 0 || rule.minimumPercent > 100) errors.push("Minimum percentage must be 0–100.");
  return errors;
}

const london = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Synthetic/local evaluation only: does not save or assign tags. */
export function evaluateTimeTag(rule: TimeTagRule, journeys: TimeTagJourney[], now: Date) {
  const errors = validateTimeTagRule(rule);
  if (errors.length) throw new Error(errors.join(" "));
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid observation time.");
  const start = parseTime(rule.start)!, end = parseTime(rule.end)!;
  const startWindow = now.getTime() - rule.windowDays * 86_400_000;
  const ids = new Set<string>();
  let eligible = 0, matched = 0, missingPickup = 0;
  let lastMatchedAt: string | null = null;
  for (const journey of journeys) {
    if (!journey.id || ids.has(journey.id)) throw new Error("Journey IDs must be unique.");
    ids.add(journey.id);
    if (journey.status.trim().toUpperCase() !== "COMPLETED") continue;
    const when = journey.pickupDueTime?.getTime();
    if (when === undefined || !Number.isFinite(when)) { missingPickup++; continue; }
    if (when < startWindow || when > now.getTime()) continue;
    const parts = london.formatToParts(journey.pickupDueTime!);
    const hour = Number(parts.find(p => p.type === "hour")?.value);
    const minute = Number(parts.find(p => p.type === "minute")?.value);
    const clock = hour * 60 + minute;
    eligible++;
    if (start < end ? clock >= start && clock < end : clock >= start || clock < end) { matched++; if(lastMatchedAt===null || when>Date.parse(lastMatchedAt))lastMatchedAt=new Date(when).toISOString(); }
  }
  const percent = eligible ? Number((matched * 100 / eligible).toFixed(1)) : null;
  return { eligible, matched, percent, missingPickup, lastMatchedAt, qualifies: percent !== null && matched >= rule.minimumMatches && matched * 100 / eligible >= rule.minimumPercent };
}
