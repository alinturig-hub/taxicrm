export type NoFareFinancialBooking = {
  paymentType?: string | null;
  bookingSource?: string | null;
  accountName?: string | null;
  arrivedAt?: Date | string | null;
  noFareAt?: Date | string | null;
  price?: unknown;
  estimatedPrice?: unknown;
  fare?: unknown;
};

export type NoFareFinancials = {
  companyRevenue: number;
  driverCost: number;
  estimatedCashLoss: number;
  revenueBucket: "ACCOUNT" | "CARD" | null;
};

function toPositiveNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : 0;
}

function timestamp(value: Date | string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }

  const result =
    value instanceof Date
      ? value.getTime()
      : new Date(value).getTime();

  return Number.isFinite(result)
    ? result
    : Number.NaN;
}

export function estimateLostRevenue(
  booking: Pick<
    NoFareFinancialBooking,
    "price" | "estimatedPrice" | "fare"
  >,
) {
  for (const value of [
    booking.price,
    booking.estimatedPrice,
    booking.fare,
  ]) {
    const number = toPositiveNumber(value);

    if (number > 0) {
      return number;
    }
  }

  return 0;
}

export function calculateNoFareFinancials(
  booking: NoFareFinancialBooking,
): NoFareFinancials {
  const paymentType =
    (booking.paymentType ?? "").trim().toUpperCase();

  const bookingSource =
    (booking.bookingSource ?? "").trim().toUpperCase();

  const accountName =
    (booking.accountName ?? "").trim().toLowerCase();

  if (paymentType === "CASH") {
    return {
      companyRevenue: 0,
      driverCost: 0,
      estimatedCashLoss: estimateLostRevenue(booking),
      revenueBucket: null,
    };
  }

  const isCmac = accountName.includes("cmac");
  const isArriva = accountName.includes("arriva");

  const isFixedSix =
    (
      paymentType === "CARD" &&
      bookingSource === "MOBILEAPP"
    ) ||
    accountName.includes("lynkpay") ||
    accountName.includes("web booker card") ||
    accountName === "ppa" ||
    accountName.includes("papp");

  if (isFixedSix) {
    return {
      companyRevenue: 6,
      driverCost: 6,
      estimatedCashLoss: 0,
      revenueBucket:
        paymentType === "CARD" ? "CARD" : "ACCOUNT",
    };
  }

  const arrivedAt = timestamp(booking.arrivedAt);
  const noFareAt = timestamp(booking.noFareAt);

  const waitingMilliseconds =
    Number.isFinite(arrivedAt) &&
    Number.isFinite(noFareAt) &&
    noFareAt > arrivedAt
      ? noFareAt - arrivedAt
      : 0;

  if (isCmac) {
    const minutes = Math.ceil(
      waitingMilliseconds / 60_000,
    );

    return {
      companyRevenue: 10.6 + minutes * 0.5,
      driverCost: 10 + minutes * 0.4,
      estimatedCashLoss: 0,
      revenueBucket: "ACCOUNT",
    };
  }

  if (isArriva) {
    const minutes = Math.ceil(
      Math.max(
        waitingMilliseconds - 5 * 60_000,
        0,
      ) / 60_000,
    );

    return {
      companyRevenue: 11 + minutes * 0.6,
      driverCost: 10 + minutes * 0.6,
      estimatedCashLoss: 0,
      revenueBucket: "ACCOUNT",
    };
  }

  if (paymentType === "ACCOUNT") {
    const minutes = Math.ceil(
      waitingMilliseconds / 60_000,
    );

    const value = 7 + minutes * 0.4;

    return {
      companyRevenue: value,
      driverCost: value,
      estimatedCashLoss: 0,
      revenueBucket: "ACCOUNT",
    };
  }

  return {
    companyRevenue: 0,
    driverCost: 0,
    estimatedCashLoss: 0,
    revenueBucket: null,
  };
}
