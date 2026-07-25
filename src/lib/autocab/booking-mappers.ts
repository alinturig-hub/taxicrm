import { Prisma } from "@/generated/prisma/client";

export function normaliseString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}

export function normaliseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

export function normaliseDecimal(
  value: unknown,
): Prisma.Decimal | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Prisma.Decimal(value.toString());
  }

  if (typeof value === "string" && value.trim() !== "") {
    try {
      return new Prisma.Decimal(value.trim());
    } catch {
      return null;
    }
  }

  return null;
}

export function normaliseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  return null;
}


export function normaliseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

export function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasOwn(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function getObject(
  object: JsonObject,
  key: string,
): JsonObject | null {
  const value = object[key];
  return isObject(value) ? value : null;
}

export function getArray(
  object: JsonObject,
  key: string,
): unknown[] | null {
  const value = object[key];
  return Array.isArray(value) ? value : null;
}

export function assignIfPresent<T>(
  target: Record<string, unknown>,
  source: JsonObject,
  sourceKey: string,
  targetKey: string,
  parser: (value: unknown) => T,
): void {
  if (hasOwn(source, sourceKey)) {
    target[targetKey] = parser(source[sourceKey]);
  }
}

export function buildLocationData(
  location: JsonObject,
): {
  address: string;
  zoneId: string | null;
  zoneDescriptor: string | null;
  zoneName: string | null;
  longitude: Prisma.Decimal | null;
  latitude: Prisma.Decimal | null;
} | null {
  const address = normaliseString(location.Address);

  if (!address) {
    return null;
  }

  const zone = getObject(location, "Zone");
  const coordinates = getObject(location, "Coordinates");

  return {
    address,
    zoneId: zone ? normaliseString(zone.Id) : null,
    zoneDescriptor: zone
      ? normaliseString(zone.Descriptor)
      : null,
    zoneName: zone ? normaliseString(zone.Name) : null,
    longitude: coordinates
      ? normaliseDecimal(coordinates.Longitude)
      : null,
    latitude: coordinates
      ? normaliseDecimal(coordinates.Latitude)
      : null,
  };
}

export function buildBookingCreateData(
  payload: JsonObject,
  externalId: string,
): Prisma.BookingCreateInput {
  const company = getObject(payload, "Company");
  const account = getObject(payload, "Account");
  const pricing = getObject(payload, "Pricing");
  const priceComparison = getObject(payload, "PriceComparison");

  return {
    provider: "AUTOCAB",
    externalId,
    originalBookingId: normaliseString(payload.OriginalBookingId),
    bookingType: normaliseString(payload.BookingType),
    typeOfBooking: normaliseString(payload.TypeOfBooking),
    status: normaliseString(payload.Status) ?? "ACTIVE",

    pickupDueTime: normaliseDate(payload.PickupDueTime),
    dropOffDueTime: normaliseDate(payload.DropOffDueTime),
    bookedAtTime: normaliseDate(payload.BookedAtTime),

    customerName: normaliseString(payload.Name),
    telephoneNumber: normaliseString(payload.TelephoneNumber),
    customerEmail: normaliseString(payload.CustomerEmail),

    paymentType: normaliseString(payload.PaymentType),
    accountType: normaliseString(payload.AccountType),
    accountId: account ? normaliseString(account.Id) : null,
    accountName: account
      ? normaliseString(account.DisplayName) ??
        normaliseString(account.Name) ??
        normaliseString(account.AccountCode)
      : null,

    companyId: company ? normaliseString(company.Id) : null,
    companyName: company ? normaliseString(company.Name) : null,
    companyRegisteredNo: company
      ? normaliseString(company.RegisteredNumber)
      : null,
    companyCode: company ? normaliseString(company.CompanyCode) : null,

    priority: normaliseInteger(payload.Priority) ?? 0,
    passengers: normaliseInteger(payload.Passengers) ?? 1,
    luggage: normaliseInteger(payload.Luggage) ?? 0,

    driverNote: normaliseString(payload.DriverNote),
    officeNote: normaliseString(payload.OfficeNote),
    ourReference: normaliseString(payload.OurReference),
    flightDetails: normaliseString(payload.FlightDetails),
    bookedBy: normaliseString(payload.BookedBy),
    bookingSource: normaliseString(payload.BookingSource),
    cabExchangeReference: normaliseString(
      payload.CabExchangeAgentBookingRef,
    ),
    loyaltyCardId: normaliseString(payload.LoyaltyCardID),
    loyaltyCardCostValue:
      normaliseDecimal(payload.LoyaltyCardCostValue) ??
      new Prisma.Decimal(0),
    isStreetPickup: normaliseBoolean(payload.IsStreetPickup) ?? false,

    fare: pricing ? normaliseDecimal(pricing.Fare) : null,
    cost: pricing ? normaliseDecimal(pricing.Cost) : null,
    price: pricing ? normaliseDecimal(pricing.Price) : null,
    extraCost: pricing ? normaliseDecimal(pricing.ExtraCost) : null,
    fixedCost: pricing ? normaliseDecimal(pricing.FixedCost) : null,
    fixedPrice: pricing ? normaliseDecimal(pricing.FixedPrice) : null,
    chargingAreaCost: pricing
      ? normaliseDecimal(pricing.ChargingAreaCost)
      : null,
    chargingAreaPrice: pricing
      ? normaliseDecimal(pricing.ChargingAreaPrice)
      : null,
    waitingTime: pricing ? normaliseDecimal(pricing.WaitingTime) : null,
    waitingTimeChargeable: pricing
      ? normaliseDecimal(pricing.WaitingTimeChargeable)
      : null,
    gratuityAmount: pricing
      ? normaliseDecimal(pricing.GratuityAmount)
      : null,
    costSource: pricing ? normaliseString(pricing.CostSource) : null,
    pricingTariff: pricing
      ? normaliseString(pricing.PricingTariff)
      : null,
    pricingSource: pricing
      ? normaliseString(pricing.PricingSource)
      : null,

    distance: normaliseDecimal(payload.Distance),
    systemDistance: normaliseDecimal(payload.SystemDistance),
    meterDistance: normaliseDecimal(payload.MeterDistance),
    meterDistanceMetres: normaliseInteger(payload.MeterDistanceAsMetres),

    gpsMeterDistance: priceComparison
      ? normaliseDecimal(priceComparison.GpsMeterDistance)
      : null,
    gpsMeterPrice: priceComparison
      ? normaliseDecimal(priceComparison.GpsMeterPrice)
      : null,
    gpsMeterPriceSource: priceComparison
      ? normaliseString(priceComparison.GpsMeterPriceSource)
      : null,
    estimatedDistance: priceComparison
      ? normaliseDecimal(priceComparison.SystemEstimatedDistance)
      : null,
    estimatedPrice: priceComparison
      ? normaliseDecimal(priceComparison.SystemEstimatedPrice)
      : null,
    estimatedPriceSource: priceComparison
      ? normaliseString(priceComparison.SystemEstimatedPriceSource)
      : null,
    estimatedTime: priceComparison
      ? normaliseString(priceComparison.EstimatedTime)
      : null,

    capabilities: jsonValue(payload.Capabilities),
    yourReferences: jsonValue(payload.YourReferences),
    promotionCodeDiscount: pricing
      ? jsonValue(pricing.PromotionCodeDiscount)
      : undefined,
    rawPayload: payload as Prisma.InputJsonObject,
  };
}
