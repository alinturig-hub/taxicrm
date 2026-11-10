import { isSharedBookingPoint } from "./customer-identity";
import { validateBookingWindows, type ValidationInput } from "./booking-window-validation";

type IdentityBooking = Parameters<typeof isSharedBookingPoint>[0][number];
export type PilotEnvelope = Omit<ValidationInput, "customers"> & {
  sourceDatabase: string;
  sourceRole: string;
  readOnly: string;
  snapshotAt: string;
  coverageStatus: string;
  samplingDesign?: "LEGACY_RANDOM_DAILY" | "STRATIFIED_RECENCY_50_30_20_6H_V1";
  poolSize: number;
  sourceRows: number;
  dailyActivity: Array<{ day: string; bookings: number }>;
  customers: Array<Omit<ValidationInput["customers"][number], "safeForPersonalisation"> & { identityHistory: IdentityBooking[] }>;
};

/** In-memory pilot only; source values/tokens never appear in the returned report. */
export function evaluateHistoricalPilot(envelope: PilotEnvelope) {
  if (envelope.sourceDatabase !== "postgres" || envelope.sourceRole !== "cabby_ro" || envelope.readOnly !== "on") throw new Error("Invalid analytical source");
  if (!Number.isInteger(envelope.sourceRows) || envelope.sourceRows > 20_000 || envelope.sourceRows < 1) throw new Error("Invalid source size");
  if (!Number.isInteger(envelope.poolSize) || envelope.poolSize < 1 || envelope.poolSize > 2000) throw new Error("Invalid pool size");
  if (!Array.isArray(envelope.customers) || envelope.customers.length > 100 || envelope.customers.length === 0) throw new Error("Invalid cohort");
  if (envelope.coverageStatus !== "CURRENT_SNAPSHOT_NOT_POINT_IN_TIME_AUDITED") throw new Error("Unexpected source coverage claim");
  if (envelope.samplingDesign !== undefined && !["LEGACY_RANDOM_DAILY", "STRATIFIED_RECENCY_50_30_20_6H_V1"].includes(envelope.samplingDesign)) throw new Error("Unknown sampling design");
  if (envelope.samplingDesign === "STRATIFIED_RECENCY_50_30_20_6H_V1" && envelope.checkpointHours !== 6) throw new Error("Stratified design requires six-hour checkpoints");
  const snapshot = Date.parse(envelope.snapshotAt);
  if (!Number.isFinite(snapshot) || snapshot < Date.parse(envelope.observedThrough)) throw new Error("Snapshot precedes observation end");
  let profilesWithoutIdentityEvidence = 0;
  let sharedProfiles = 0;
  let rows = 0;
  const customers = envelope.customers.map((profile) => {
    if (!profile.availableAt || profile.availableAt.length !== profile.bookedAt.length || profile.availableAt.some((at) => Date.parse(at) > snapshot)) throw new Error("Invalid source availability");
    rows += profile.bookedAt.length;
    if (rows > 20_000) throw new Error("Too many source rows");
    // Missing identity evidence is not proof that the contact is an individual.
    const evidence = profile.identityHistory;
    if (!Array.isArray(evidence) || evidence.length > 20_000) throw new Error("Invalid identity evidence");
    const complete = evidence.filter((booking) =>
      booking.locations.some((item) => item.type === "PICKUP" && item.address) &&
      booking.locations.some((item) => item.type === "DESTINATION" && item.address),
    ).length;
    const sufficient = evidence.length >= 5 && complete / evidence.length >= 0.8;
    const shared = isSharedBookingPoint(evidence);
    const start = Date.parse(envelope.evaluationStart);
    const known = profile.bookedAt.map((at, index) => ({ time: Date.parse(at), available: Date.parse(profile.availableAt![index]) }))
      .filter((row) => row.time <= start && row.available <= start);
    if (known.length === 0) throw new Error("No known pre-period history");
    const lastKnown = Math.max(...known.map((row) => row.time));
    const segment = lastKnown >= start - 60 * 86_400_000 ? "RECENT_60D" as const
      : lastKnown >= start - 180 * 86_400_000 ? "IDLE_61_180D" as const : "DORMANT_181D_PLUS" as const;
    if (profile.segment && profile.segment !== segment) throw new Error("Recency segment inconsistent with pre-period history");
    if (!sufficient) profilesWithoutIdentityEvidence++;
    if (shared) sharedProfiles++;
    return { key: profile.key, bookedAt: profile.bookedAt, availableAt: profile.availableAt, segment, safeForPersonalisation: sufficient && !shared };
  });
  if (rows !== envelope.sourceRows) throw new Error("Source row count mismatch");
  const report = validateBookingWindows({ ...envelope, customers }, 6000);
  const compactHorizons = (horizons: typeof report.horizons) => horizons.map((horizon) => ({
    hours: horizon.horizonHours, samples: horizon.model.samples, positives: horizon.model.positives,
    evaluatedProfiles: horizon.evaluatedProfiles, positiveProfiles: horizon.positiveProfiles,
    baseRate: horizon.model.baseRate, top20Precision: horizon.model.top20Precision,
    top20Recall: horizon.model.top20Recall, top20Lift: horizon.model.top20Lift,
    baselinePrecision: horizon.frequencyBaseline.top20Precision, baselineLift: horizon.frequencyBaseline.top20Lift,
    learningSnapshots: horizon.learningSnapshots, censoredSnapshots: horizon.censoredSnapshots,
    outsideHorizon: horizon.matchingSlotsOutsideHorizon,
  }));
  return {
    state: "DIAGNOSTIC_ONLY_NOT_DEPLOYMENT_APPROVAL",
    dataKind: report.dataKind, model: report.model, implementationRevision: report.implementationRevision,
    samplingDesign: envelope.samplingDesign ?? "LEGACY_RANDOM_DAILY", checkpointHours: report.checkpointHours,
    source: { database: "postgres", role: "cabby_ro", readOnly: true, snapshotAt: new Date(snapshot).toISOString() },
    period: { evaluationStart: report.evaluationStart, observedThrough: report.observedThrough },
    cohort: { poolSize: envelope.poolSize, selectedProfiles: report.inputCustomers, evaluatedProfiles: report.eligibleProfiles, excludedProfiles: report.inputCustomers - report.eligibleProfiles, sharedProfiles, profilesWithoutIdentityEvidence, sourceRows: rows, lateImportedActionsInEvaluatedProfiles: report.lateImportedActions, duplicateActionsRemoved: report.duplicateActionsRemoved },
    dailyActivity: envelope.dailyActivity.map((day) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.day) || !Number.isInteger(day.bookings) || day.bookings < 0) throw new Error("Invalid daily count");
      return { day: day.day, bookings: day.bookings };
    }),
    horizons: compactHorizons(report.horizons),
    segments: report.segments.map((segment) => ({ segment: segment.segment, profiles: segment.profiles, horizons: compactHorizons(segment.horizons) })),
    limitations: [
      "Bounded pilot, not a full-population or independent calibration study; repeated customer snapshots are dependent.",
      "Diagnostic recency quotas do not represent population proportions. Segment ranks are evaluated separately; the design was revised after inspecting the initial pilot.",
      "Database creation times prevent training on rows not yet imported. Later timestamp corrections and identity merges cannot be reconstructed from this snapshot.",
      "Daily source activity is diagnostic and does not prove complete historical ingestion. Marketing permissions and sending remain separate.",
      "Missing-time/unlinked bookings are outside individual scoring. Location-evidence coverage is a conservative pilot filter, not a production rule change.",
    ],
  };
}
