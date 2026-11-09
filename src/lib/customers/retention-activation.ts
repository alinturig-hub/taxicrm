/** Early activation counts completed journeys only; it does not classify loyalty. */
export type RetentionJourney = {
  id: string;
  status: string;
  completedAt: Date | null;
};

export function earlyRetentionProgress(journeys: RetentionJourney[], now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid observation time");
  const ids = new Set<string>();
  const completed: Date[] = [];
  let undatedCompleted = 0;
  for (const journey of journeys) {
    if (!journey.id || ids.has(journey.id)) throw new Error("Journey IDs must be unique");
    ids.add(journey.id);
    if (journey.status.toUpperCase() !== "COMPLETED") continue;
    if (!journey.completedAt || !Number.isFinite(journey.completedAt.getTime())) {
      undatedCompleted++;
    } else if (journey.completedAt <= now) {
      completed.push(journey.completedAt);
    }
  }
  completed.sort((a, b) => a.getTime() - b.getTime());
  const first = completed[0] ?? null;
  const within = (days: number) => first
    ? completed.filter(date => date.getTime() < first.getTime() + days * 86_400_000).length
    : 0;
  const within7Days = within(7), within14Days = within(14);
  return {
    observedAt: now.toISOString(),
    firstCompletedAt: first,
    datedCompleted: completed.length,
    undatedCompleted,
    completedWithin7Days: within7Days,
    completedWithin14Days: within14Days,
    reached5Within7Days: undatedCompleted ? null : within7Days >= 5,
    reached5Within14Days: undatedCompleted ? null : within14Days >= 5,
    evidenceIncomplete: undatedCompleted > 0,
  };
}

export function retentionForCustomerProfile(
  journeys: RetentionJourney[],
  identityType: string,
  now: Date,
) {
  return identityType === "SHARED_BOOKING_POINT" ? null : earlyRetentionProgress(journeys, now);
}
