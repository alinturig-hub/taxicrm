import {
  addLondonDays,
  startOfLondonDay,
  startOfLondonWeek,
  londonDateKey,
} from "@/lib/time/london-calendar";
export type Payment = "ALL" | "CASH" | "ACCOUNT" | "CARD";
export type Preset =
  | "today"
  | "this-week"
  | "last-hour"
  | "last-6-hours"
  | "last-12-hours"
  | "custom";
export type Range = {
  from: Date;
  to: Date;
  preset: Preset;
  payment: Payment;
  calendarDays: number;
};
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function localDate(s: string | null) {
  if (!s || !datePattern.test(s))
    throw Error("Choose valid start and end dates.");
  const d = new Date(s + "T12:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== s)
    throw Error("Choose valid start and end dates.");
  return startOfLondonDay(d);
}
export const dayKey = (d: Date) => londonDateKey(d).toISOString().slice(0, 10);
export function parseRange(p: URLSearchParams, now = new Date()): Range {
  const preset = p.get("preset") || "today",
    payment = p.get("payment") || "ALL";
  if (
    ![
      "today",
      "this-week",
      "last-hour",
      "last-6-hours",
      "last-12-hours",
      "custom",
    ].includes(preset) ||
    !["ALL", "CASH", "ACCOUNT", "CARD"].includes(payment)
  )
    throw Error("Invalid period or payment filter.");
  let from: Date,
    to = now;
  if (preset === "custom") {
    from = localDate(p.get("from"));
    to = addLondonDays(localDate(p.get("to")), 1);
  } else if (preset === "today") from = startOfLondonDay(now);
  else if (preset === "this-week") from = startOfLondonWeek(now);
  else
    from = new Date(
      now.getTime() -
        ({ "last-hour": 1, "last-6-hours": 6, "last-12-hours": 12 }[preset] ||
          1) *
          3600000,
    );
  if (from >= to || to.getTime() - from.getTime() > 367 * 86400000)
    throw Error("Choose an ordered range of at most 366 calendar days.");
  // Count selected London dates; end is exclusive, including on DST days.
  const end = new Date(to.getTime() - 1);
  let days = 0,
    walk = startOfLondonDay(from);
  while (dayKey(walk) <= dayKey(end) && days < 368) {
    days++;
    walk = addLondonDays(walk, 1);
  }
  if (days > 366) throw Error("Choose at most 366 calendar days.");
  return {
    from,
    to,
    preset: preset as Preset,
    payment: payment as Payment,
    calendarDays: days,
  };
}
export type Totals = {
  total: number;
  completed: number;
  cancelled: number;
  noFare: number;
  rejected: number;
  recovered: number;
  prebook: number;
  cash: number;
  account: number;
  card: number;
  other: number;
  missingPrice: number;
  missingCost: number;
  unknownArea: number;
  gross: number;
  cashIncome: number;
  accountIncome: number;
  cardIncome: number;
  otherIncome: number;
  driverMoney: number;
  margin: number | null;
};
export type Area = Totals & {
  key: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};
export type Ranking = { label: string; count: number };
export type AnalyticsData = {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    preset: Preset;
    payment: Payment;
    calendarDays: number;
  };
  comparison?: {
    from: string; to: string; total: number; completed: number; gross: number; missingPrice: number;
    cancelled?: number; noFare?: number; rejected?: number; margin?: number | null;
    areas?: { key: string; total: number }[];
  };
  totals: Totals;
  areas: Area[];
  revenueTrend: { date: string; gross: number; driverMoney: number }[];
  hours: { hour: number; count: number }[];
  days: { date: string; count: number }[];
  weekdays: { day: number; count: number }[];
  heat: { day: number; hour: number; count: number }[];
  drivers: {
    rejected: Ranking[];
    noFare: Ranking[];
    recovered: Ranking[];
    unattributed: number;
  };
  rent: {
    estimated: number | null;
    fullRentDrivers: number | null;
    fullRentDriverWeeks: number | null;
    rate: number | null;
    cap: number | null;
    missingCosts: number;
  };
};
export const defaultCards = [
  "total",
  "completed",
  "cancelled",
  "noFare",
  "gross",
  "driverMoney",
  "margin",
  "profitableArea",
] as const;
export const cardLabels = {
  total: "Total bookings",
  completed: "Completed bookings",
  cancelled: "Cancelled bookings",
  noFare: "No fare bookings",
  rejected: "Rejected bookings",
  recovered: "Recovered bookings",
  gross: "Total income · gross",
  cashIncome: "Cash income",
  accountIncome: "Account income",
  cardIncome: "Card income",
  driverMoney: "Driver revenue · Cost",
  margin: "Company margin · Price − Cost",
  rent: "Estimated driver rent",
  fullRent: "Full rent drivers · estimated",
  companyIncome: "Company income · actual rent required",
  profitableArea: "Most profitable recorded area",
  noFareArea: "Most no fare area",
  cancelledArea: "Most cancelled area",
  rejectedArea: "Most rejected area",
  cashArea: "Most cash area",
  accountArea: "Most account area",
  cardArea: "Most card area",
  prebookArea: "Most pre-booked area",
  recoveredArea: "Most recovered area",
  busyArea: "Busiest area",
};
export type CardId = keyof typeof cardLabels;
export function cleanCards(input: unknown): CardId[] {
  return Array.isArray(input)
    ? Array.from(
        new Set(
          input.filter(
            (v): v is CardId =>
              typeof v === "string" &&
              Object.prototype.hasOwnProperty.call(cardLabels, v),
          ),
        ),
      ).slice(0, Object.keys(cardLabels).length)
    : [];
}
export function topArea(areas: Area[], metric: keyof Totals) {
  return (
    areas
      .filter(
        (a) =>
          a.key !== "UNKNOWN" &&
          a[metric] !== null &&
          (metric !== "margin" || a.completed > 0),
      )
      .sort(
        (a, b) =>
          Number(b[metric]) - Number(a[metric]) || a.name.localeCompare(b.name),
      )
      .find((a) => metric === "margin" || Number(a[metric]) > 0) || null
  );
}
export function rentEstimate(
  rows: { driver: string; week: string; earnings: number; missing: number }[],
  rate: number | null,
  cap: number | null,
) {
  const missingCosts = rows.reduce((n, r) => n + r.missing, 0);
  if (
    rate === null ||
    cap === null ||
    rate < 0 ||
    rate > 100 ||
    cap <= 0 ||
    missingCosts
  )
    return {
      estimated: null,
      fullRentDrivers: null,
      fullRentDriverWeeks: null,
      rate,
      cap,
      missingCosts,
    };
  const full = new Set<string>();
  let estimated = 0,
    weeks = 0;
  for (const r of rows) {
    const amount = (Math.max(0, r.earnings) * rate) / 100;
    estimated += Math.min(amount, cap);
    if (amount >= cap) {
      full.add(r.driver);
      weeks++;
    }
  }
  return {
    estimated: Number(estimated.toFixed(2)),
    fullRentDrivers: full.size,
    fullRentDriverWeeks: weeks,
    rate,
    cap,
    missingCosts,
  };
}

// Equal elapsed duration immediately preceding the selected pickup window.
// Explicit timestamps prevent a DST comparison from implying equal local clock hours.
export function previousRange(range: Range): Range {
  return { ...range, from: new Date(2 * range.from.getTime() - range.to.getTime()), to: new Date(range.from) };
}
export function percentage(part: number, whole: number): number | null {
  return whole > 0 ? part / whole * 100 : null;
}
export function changePercent(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous * 100 : null;
}
