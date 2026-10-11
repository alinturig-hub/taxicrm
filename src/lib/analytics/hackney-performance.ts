import { addLondonDays, startOfLondonDay } from "@/lib/time/london-calendar";

export function hackneyPeriod(fromDate: string, toDate: string) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error("Use dates in YYYY-MM-DD format.");
    const date = new Date(`${value}T12:00:00Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new Error("Invalid calendar date.");
    }
    return startOfLondonDay(date);
  };
  const from = parse(fromDate);
  const to = addLondonDays(parse(toDate), 1);
  if (from >= to)
    throw new Error("The start date must not follow the end date.");
  if (to.getTime() - from.getTime() > 367 * 86400000) {
    throw new Error("Select a period of at most one year.");
  }
  return { from, to, fromDate, toDate, timeZone: "Europe/London" as const };
}

export function normaliseBadge(value: string | null): string | null {
  // Badge identifiers are strings: preserve leading zeroes and punctuation.
  return value?.trim().toUpperCase() || null;
}

export type HackneyDriver = {
  id: string;
  badgeNumber: string | null;
  fullName: string | null;
  forename: string | null;
  surname: string | null;
};

export type HackneyBooking = {
  driverBadgeNumber: string | null;
  status: string;
  fare: { toString(): string } | number | string | null;
};

type Totals = {
  total: number;
  completed: number;
  cancelled: number;
  noFare: number;
  otherStatuses: number;
  recordedFare: number;
  completedWithoutFare: number;
  completionRate: number | null;
};

export type HackneyDriverRow = Totals & {
  badge: string | null;
  driverId: string | null;
  driverName: string | null;
  association: "matched" | "missing" | "unmatched" | "ambiguous";
};

function emptyTotals(): Totals {
  return {
    total: 0,
    completed: 0,
    cancelled: 0,
    noFare: 0,
    otherStatuses: 0,
    recordedFare: 0,
    completedWithoutFare: 0,
    completionRate: null,
  };
}

function addBooking(totals: Totals, booking: HackneyBooking) {
  totals.total++;
  const status = booking.status.trim().toUpperCase();
  if (status === "COMPLETED") {
    totals.completed++;
    const recorded = booking.fare?.toString().trim();
    const fare = recorded ? Number(recorded) : NaN;
    if (Number.isFinite(fare) && fare >= 0) totals.recordedFare += fare;
    else totals.completedWithoutFare++;
  } else if (status === "CANCELLED") totals.cancelled++;
  else if (status === "NO_FARE") totals.noFare++;
  else totals.otherStatuses++;
}

export function summariseHackneyDrivers(
  bookings: HackneyBooking[],
  drivers: HackneyDriver[],
) {
  const byBadge = new Map<string, HackneyDriver[]>();
  for (const driver of drivers) {
    const badge = normaliseBadge(driver.badgeNumber);
    if (badge) byBadge.set(badge, [...(byBadge.get(badge) ?? []), driver]);
  }
  const rows = new Map<string, HackneyDriverRow>();
  const totals = emptyTotals();
  const quality = { missingBadge: 0, unmatchedBadge: 0, ambiguousBadge: 0 };
  for (const booking of bookings) {
    const badge = normaliseBadge(booking.driverBadgeNumber);
    const matches = badge ? (byBadge.get(badge) ?? []) : [];
    const association = !badge
      ? "missing"
      : matches.length === 0
        ? "unmatched"
        : matches.length > 1
          ? "ambiguous"
          : "matched";
    if (association === "missing") quality.missingBadge++;
    if (association === "unmatched") quality.unmatchedBadge++;
    if (association === "ambiguous") quality.ambiguousBadge++;
    const key = badge ?? "";
    let row = rows.get(key);
    if (!row) {
      const driver = association === "matched" ? matches[0] : null;
      row = {
        ...emptyTotals(),
        badge,
        association,
        driverId: driver?.id ?? null,
        driverName:
          driver?.fullName?.trim() ||
          [driver?.forename, driver?.surname]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          null,
      };
      rows.set(key, row);
    }
    addBooking(row, booking);
    addBooking(totals, booking);
  }
  const finish = (value: Totals) => {
    value.recordedFare = Number(value.recordedFare.toFixed(2));
    value.completionRate = value.total
      ? Number(((100 * value.completed) / value.total).toFixed(1))
      : null;
  };
  finish(totals);
  const sorted = Array.from(rows.values());
  sorted.forEach(finish);
  sorted.sort(
    (a, b) =>
      b.completed - a.completed ||
      b.total - a.total ||
      (a.badge ?? "").localeCompare(b.badge ?? ""),
  );
  return { totals, drivers: sorted, quality };
}
