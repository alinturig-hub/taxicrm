/** Provider-neutral, versioned contracts. Definitions only; no adapter is activated. */
export const SOURCE_CONTRACT_VERSION = 1 as const;
export type SourceKind = "autocab" | "needacabplus";
export type SourceIdentity = { connectionId: string; kind: SourceKind; externalId: string };
export type Observation = {
  source: SourceIdentity;
  /** UTC instant as an ISO-8601 string; different from the time the event occurred. */
  observedAt: string;
};
export type SourceCapabilities = {
  bookings: boolean; drivers: boolean; vehicles: boolean; shifts: boolean; vehicleTracking: boolean;
};
export type DriverRecord = Observation & { name: string | null; callsign: string | null; active: boolean | null };
export type VehicleRecord = Observation & { callsign: string | null; registration: string | null };
export type BookingRecord = Observation & {
  status: string; driver: SourceIdentity | null; vehicle: SourceIdentity | null;
  bookedAt: string | null; pickupDueAt: string | null; acceptedAt: string | null; completedAt: string | null;
  cancelledAt: string | null; noFareAt: string | null;
  currency: string | null; priceMinor: number | null; costMinor: number | null;
};
export type ShiftRecord = Observation & { driver: SourceIdentity; vehicle: SourceIdentity | null; startedAt: string; endedAt: string | null };
export type TrackingPoint = Observation & { driver: SourceIdentity | null; vehicle: SourceIdentity; booking: SourceIdentity | null; occurredAt: string; latitude: number; longitude: number };
/** Delivery identity must be stable across retries and scoped to its connection. */
export type SourceEvent<T> = { version: typeof SOURCE_CONTRACT_VERSION; connectionId: string; eventId: string; occurredAt: string; receivedAt: string; payload: T };
export function sameSourceIdentity(a: SourceIdentity, b: SourceIdentity): boolean {
  return a.connectionId === b.connectionId && a.kind === b.kind && a.externalId === b.externalId;
}
