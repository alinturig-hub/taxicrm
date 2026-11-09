"use client";

type RetentionProgress = {
  firstCompletedAt: string | null;
  observedAt: string;
  completedWithin7Days: number;
  completedWithin14Days: number;
  reached5Within7Days: boolean | null;
  reached5Within14Days: boolean | null;
  undatedCompleted: number;
  evidenceIncomplete: boolean;
};

export default function RetentionProgressCard({ progress }: { progress: RetentionProgress }) {
  const first = progress.firstCompletedAt && new Date(progress.firstCompletedAt);
  const formatted = first && Number.isFinite(first.getTime())
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(first)
    : null;
  const observed = new Date(progress.observedAt).getTime();
  const status = (reached: boolean | null, days: number) => {
    if (reached === null) return "Outcome unknown";
    if (reached) return "Reached";
    if (!first || !Number.isFinite(first.getTime()) || !Number.isFinite(observed)) return "Outcome unknown";
    return observed < first.getTime() + days * 86_400_000 ? "In progress" : "Window ended";
  };
  return (
    <section aria-label="Early retention progress" className="rounded-2xl border border-app-border bg-surface p-5 text-app-primary">
      <h3 className="font-semibold">First five completed journeys</h3>
      <p className="mt-2 text-sm text-app-muted">Counts start with the first recorded completed journey. Cancelled and no-fare bookings are excluded.</p>
      {!formatted ? <p className="mt-4 text-sm">No dated completed journey is available.</p> : <>
        <p className="mt-4 text-sm">First recorded completion: {formatted} · London</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-app-border p-4"><p className="text-sm text-app-muted">First 7 days</p><p className="mt-1 text-xl font-semibold">{progress.completedWithin7Days} / 5</p><p className="mt-1 text-sm">{status(progress.reached5Within7Days, 7)}</p></div>
          <div className="rounded-xl border border-app-border p-4"><p className="text-sm text-app-muted">First 14 days</p><p className="mt-1 text-xl font-semibold">{progress.completedWithin14Days} / 5</p><p className="mt-1 text-sm">{status(progress.reached5Within14Days, 14)}</p></div>
        </div>
      </>}
      {progress.evidenceIncomplete && <p role="status" className="mt-4 text-sm text-amber-300">{progress.undatedCompleted} completed journey(s) have no valid completion time, so the outcome cannot be confirmed.</p>}
    </section>
  );
}
