export function bookingEvidenceReadiness(counts: {
  known: number;
  missingDate: number;
  missingSource: number;
  futureDates?: number;
}) {
  const blockers: string[] = [];
  if (!counts.known)
    blockers.push(
      "This line has no observed booking history; verify the line number before activation.",
    );
  if (counts.missingDate)
    blockers.push(
      `${counts.missingDate} matching bookings have no verified creation timestamp. No import or pickup date is substituted.`,
    );
  if (counts.missingSource)
    blockers.push(
      `${counts.missingSource} bookings in this window have no identifiable source. Inactivity cannot be verified safely.`,
    );
  if (counts.futureDates)
    blockers.push(
      `${counts.futureDates} matching bookings have future creation timestamps. Verify the provider date before activation.`,
    );
  return { ready: blockers.length === 0, blockers };
}
