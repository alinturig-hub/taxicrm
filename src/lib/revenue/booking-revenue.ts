import { bookingValue } from "./booking-value";
import { prisma } from "@/lib/prisma";

export type RevenueBooking = {
  status?: string | null;
  completedAt?: Date | null;
  noFareAt?: Date | null;
  arrivedAt?: Date | null;
  price?: unknown;
  cost?: unknown;
  provider?: string | null;
  accountId?: string | null;
  accountCode?: string | null;
};

export type AccountRevenueRuleValue = {
  provider: string;
  accountId: string;
  accountCode: string;
  waitingChargeable: boolean;
  waitingRatePerMinute: unknown;
};

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function baseBookingRevenue(
  booking: Pick<RevenueBooking, "price" | "cost">,
): number {
  return bookingValue(booking) ?? 0;
}

export function isCompletedRevenueBooking(
  booking: RevenueBooking,
): boolean {
  return (
    booking.completedAt !== null &&
    booking.completedAt !== undefined
  ) || booking.status === "COMPLETED";
}

export function isAccountNoFareBooking(
  booking: RevenueBooking,
): boolean {
  const isNoFare =
    (
      booking.noFareAt !== null &&
      booking.noFareAt !== undefined
    ) ||
    booking.status === "NO_FARE";

  return (
    isNoFare &&
    Boolean(booking.accountId?.trim())
  );
}

export function accountRevenueRuleKey(
  booking: Pick<RevenueBooking, "provider" | "accountId">,
): string | null {
  const accountId = booking.accountId?.trim();
  const provider = booking.provider?.trim() || "AUTOCAB";

  if (!accountId) {
    return null;
  }

  return JSON.stringify([provider, accountId]);
}

export function calculateNoFareWaitingCharge(
  booking: RevenueBooking,
  rule?: AccountRevenueRuleValue,
): number {
  if (
    !rule?.waitingChargeable ||
    !booking.arrivedAt ||
    !booking.noFareAt
  ) {
    return 0;
  }

  const durationMs =
    booking.noFareAt.getTime() -
    booking.arrivedAt.getTime();

  if (durationMs <= 0) {
    return 0;
  }

  const minutes = durationMs / 60000;
  const rate = toNumber(rule.waitingRatePerMinute);

  return roundMoney(minutes * rate);
}

export function calculateBookingRevenue(
  booking: RevenueBooking,
  rule?: AccountRevenueRuleValue,
): number {
  if (isCompletedRevenueBooking(booking)) {
    return roundMoney(baseBookingRevenue(booking));
  }

  if (!isAccountNoFareBooking(booking)) {
    return 0;
  }

  const baseRevenue = baseBookingRevenue(booking);
  const waitingCharge =
    calculateNoFareWaitingCharge(booking, rule);

  return roundMoney(baseRevenue + waitingCharge);
}

export async function loadAccountRevenueRuleMap(
  bookings: RevenueBooking[],
): Promise<Map<string, AccountRevenueRuleValue>> {
  const uniqueAccounts = new Map<
    string,
    { provider: string; accountId: string }
  >();

  for (const booking of bookings) {
    const key = accountRevenueRuleKey(booking);

    if (!key) {
      continue;
    }

    uniqueAccounts.set(key, {
      provider: booking.provider?.trim() || "AUTOCAB",
      accountId: booking.accountId!.trim(),
    });
  }

  if (uniqueAccounts.size === 0) {
    return new Map();
  }

  const rules = await prisma.accountRevenueRule.findMany({
    where: {
      OR: Array.from(uniqueAccounts.values()),
    },
    select: {
      provider: true,
      accountId: true,
      accountCode: true,
      waitingChargeable: true,
      waitingRatePerMinute: true,
    },
  });

  return new Map(
    rules.map((rule) => [
      accountRevenueRuleKey(rule)!,
      rule,
    ]),
  );
}
