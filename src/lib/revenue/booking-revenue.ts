import { prisma } from "@/lib/prisma";

export type RevenueBooking = {
  status?: string | null;
  completedAt?: Date | null;
  noFareAt?: Date | null;
  arrivedAt?: Date | null;
  price?: unknown;
  cost?: unknown;
  accountId?: string | null;
  accountCode?: string | null;
};

export type AccountRevenueRuleValue = {
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
  const price = toNumber(booking.price);
  const cost = toNumber(booking.cost);

  return price > 0 ? price : cost;
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
    Boolean(booking.accountId?.trim()) &&
    Boolean(booking.accountCode?.trim())
  );
}

export function accountRevenueRuleKey(
  booking: Pick<RevenueBooking, "accountId" | "accountCode">,
): string | null {
  const accountId = booking.accountId?.trim();
  const accountCode = booking.accountCode?.trim();

  if (!accountId || !accountCode) {
    return null;
  }

  return `${accountId}::${accountCode}`;
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
    { accountId: string; accountCode: string }
  >();

  for (const booking of bookings) {
    const key = accountRevenueRuleKey(booking);

    if (!key) {
      continue;
    }

    uniqueAccounts.set(key, {
      accountId: booking.accountId!.trim(),
      accountCode: booking.accountCode!.trim(),
    });
  }

  if (uniqueAccounts.size === 0) {
    return new Map();
  }

  const rules = await prisma.accountRevenueRule.findMany({
    where: {
      provider: "AUTOCAB",
      OR: Array.from(uniqueAccounts.values()),
    },
    select: {
      accountId: true,
      accountCode: true,
      waitingChargeable: true,
      waitingRatePerMinute: true,
    },
  });

  return new Map(
    rules.map((rule) => [
      `${rule.accountId}::${rule.accountCode}`,
      rule,
    ]),
  );
}
