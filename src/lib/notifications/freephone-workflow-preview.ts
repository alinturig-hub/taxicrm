export const freephoneEvents = ["DAILY_REPORT", "NO_BOOKINGS", "BELOW_THRESHOLD"] as const;
export type FreephoneEvent = typeof freephoneEvents[number];
export type FreephoneRule = {event: FreephoneEvent; enabled: boolean; text: string; recipient: string; threshold?: number};
export type FreephoneWorkflow = {name: string; defaultRecipient: string; rules: FreephoneRule[]};
export type FreephoneObservation = {sourceName: string | null; bookedAt: Date | null};

function recipient(value: string) {
  const normalized = value.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("Supply an international SMS recipient, globally or for each enabled event.");
  return normalized;
}
export function previewFreephoneWorkflow(workflow: FreephoneWorkflow, count: number) {
  if (!workflow.name.trim()) throw new Error("Freephone name is required.");
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Preview booking count must be a non-negative integer.");
  const seen = new Set<string>();
  return workflow.rules.filter(rule => rule.enabled).map(rule => {
    if (!freephoneEvents.includes(rule.event) || seen.has(rule.event)) throw new Error("Use each event once.");
    seen.add(rule.event);
    if (!rule.text.trim()) throw new Error(`SMS text is required for ${rule.event}.`);
    if (rule.event === "BELOW_THRESHOLD" && (!Number.isSafeInteger(rule.threshold) || rule.threshold! < 1)) throw new Error("Set a positive integer booking threshold.");
    const to = recipient(rule.recipient.trim() || workflow.defaultRecipient.trim());
    const values: Record<string, string> = {freephone: workflow.name.trim(), count: String(count), period: "24 hours", threshold: String(rule.threshold ?? "")};
    const text = rule.text.replace(/\{([a-z_]+)\}/g, (placeholder, name: string) => {
      if (!Object.hasOwn(values, name)) throw new Error(`Unknown message placeholder: ${placeholder}`);
      if (name === "threshold" && rule.event !== "BELOW_THRESHOLD") throw new Error("The threshold placeholder is only available for the threshold event.");
      return values[name];
    });
    const triggered = rule.event === "DAILY_REPORT" || (rule.event === "NO_BOOKINGS" ? count === 0 : count < rule.threshold!);
    return {event: rule.event, triggered, recipient: to, text, simulationOnly: true};
  });
}

/** Only usable after a provider adapter supplies a verified sourceName. Never substitutes the customer's phone/name. */
export function countFreephoneBookings(name: string, observations: FreephoneObservation[], now: Date) {
  if (!name.trim() || !Number.isFinite(now.getTime())) throw new Error("A freephone name and valid reference time are required.");
  const start = now.getTime() - 24 * 60 * 60 * 1000;
  let count = 0, missingSource = 0, missingDate = 0;
  for (const booking of observations) {
    if (!booking.sourceName?.trim()) {missingSource++; continue;}
    if (booking.sourceName.trim() !== name.trim()) continue;
    if (!booking.bookedAt || !Number.isFinite(booking.bookedAt.getTime())) {missingDate++; continue;}
    const time = booking.bookedAt.getTime();
    if (time > start && time <= now.getTime()) count++;
  }
  return {count, missingSource, missingDate, from: new Date(start), through: now};
}
