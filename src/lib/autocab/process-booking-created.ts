import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createBookingSnapshot } from "@/lib/services/booking-snapshot-service";

type JsonObject = Record<string, unknown>;

type LocationType = "PICKUP" | "DESTINATION";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getObject(object: JsonObject, key: string): JsonObject | null {
  const value = object[key];
  return isObject(value) ? value : null;
}

function getArray(object: JsonObject, key: string): unknown[] | null {
  const value = object[key];
  return Array.isArray(value) ? value : null;
}

function normaliseString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}

function normaliseInteger(value: unknown): number | null {
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

function normaliseDecimal(value: unknown): Prisma.Decimal | null {
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

function normaliseBoolean(value: unknown): boolean | null {
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

function normaliseDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function assignIfPresent<T>(
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

function buildBookingCreateData(
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

function buildBookingUpdateData(
  payload: JsonObject,
): Prisma.BookingUpdateInput {
  const data: Record<string, unknown> = {
    rawPayload: payload as Prisma.InputJsonObject,
  };

  assignIfPresent(
    data,
    payload,
    "OriginalBookingId",
    "originalBookingId",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "BookingType",
    "bookingType",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "TypeOfBooking",
    "typeOfBooking",
    normaliseString,
  );
  assignIfPresent(data, payload, "Status", "status", normaliseString);

  assignIfPresent(
    data,
    payload,
    "PickupDueTime",
    "pickupDueTime",
    normaliseDate,
  );
  assignIfPresent(
    data,
    payload,
    "DropOffDueTime",
    "dropOffDueTime",
    normaliseDate,
  );
  assignIfPresent(
    data,
    payload,
    "BookedAtTime",
    "bookedAtTime",
    normaliseDate,
  );

  assignIfPresent(data, payload, "Name", "customerName", normaliseString);
  assignIfPresent(
    data,
    payload,
    "TelephoneNumber",
    "telephoneNumber",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "CustomerEmail",
    "customerEmail",
    normaliseString,
  );

  assignIfPresent(
    data,
    payload,
    "PaymentType",
    "paymentType",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "AccountType",
    "accountType",
    normaliseString,
  );

  if (hasOwn(payload, "Account")) {
    const account = getObject(payload, "Account");

    data.accountId = account ? normaliseString(account.Id) : null;
    data.accountName = account
      ? normaliseString(account.DisplayName) ??
        normaliseString(account.Name) ??
        normaliseString(account.AccountCode)
      : null;
  }

  if (hasOwn(payload, "Company")) {
    const company = getObject(payload, "Company");

    data.companyId = company ? normaliseString(company.Id) : null;
    data.companyName = company ? normaliseString(company.Name) : null;
    data.companyRegisteredNo = company
      ? normaliseString(company.RegisteredNumber)
      : null;
    data.companyCode = company
      ? normaliseString(company.CompanyCode)
      : null;
  }

  assignIfPresent(data, payload, "Priority", "priority", normaliseInteger);
  assignIfPresent(
    data,
    payload,
    "Passengers",
    "passengers",
    normaliseInteger,
  );
  assignIfPresent(data, payload, "Luggage", "luggage", normaliseInteger);

  assignIfPresent(
    data,
    payload,
    "DriverNote",
    "driverNote",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "OfficeNote",
    "officeNote",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "OurReference",
    "ourReference",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "FlightDetails",
    "flightDetails",
    normaliseString,
  );
  assignIfPresent(data, payload, "BookedBy", "bookedBy", normaliseString);
  assignIfPresent(
    data,
    payload,
    "BookingSource",
    "bookingSource",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "CabExchangeAgentBookingRef",
    "cabExchangeReference",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "LoyaltyCardID",
    "loyaltyCardId",
    normaliseString,
  );
  assignIfPresent(
    data,
    payload,
    "LoyaltyCardCostValue",
    "loyaltyCardCostValue",
    normaliseDecimal,
  );
  assignIfPresent(
    data,
    payload,
    "IsStreetPickup",
    "isStreetPickup",
    normaliseBoolean,
  );

  if (hasOwn(payload, "Pricing")) {
    const pricing = getObject(payload, "Pricing");

    if (!pricing) {
      data.fare = null;
      data.cost = null;
      data.price = null;
      data.extraCost = null;
      data.fixedCost = null;
      data.fixedPrice = null;
      data.chargingAreaCost = null;
      data.chargingAreaPrice = null;
      data.waitingTime = null;
      data.waitingTimeChargeable = null;
      data.gratuityAmount = null;
      data.costSource = null;
      data.pricingTariff = null;
      data.pricingSource = null;
      data.promotionCodeDiscount = Prisma.JsonNull;
    } else {
      assignIfPresent(data, pricing, "Fare", "fare", normaliseDecimal);
      assignIfPresent(data, pricing, "Cost", "cost", normaliseDecimal);
      assignIfPresent(data, pricing, "Price", "price", normaliseDecimal);
      assignIfPresent(
        data,
        pricing,
        "ExtraCost",
        "extraCost",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        pricing,
        "FixedCost",
        "fixedCost",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        pricing,
        "FixedPrice",
        "fixedPrice",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        pricing,
        "ChargingAreaCost",
        "chargingAreaCost",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        pricing,
        "ChargingAreaPrice",
        "chargingAreaPrice",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        pricing,
        "WaitingTime",
        "waitingTime",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        pricing,
        "WaitingTimeChargeable",
        "waitingTimeChargeable",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        pricing,
        "GratuityAmount",
        "gratuityAmount",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        pricing,
        "CostSource",
        "costSource",
        normaliseString,
      );
      assignIfPresent(
        data,
        pricing,
        "PricingTariff",
        "pricingTariff",
        normaliseString,
      );
      assignIfPresent(
        data,
        pricing,
        "PricingSource",
        "pricingSource",
        normaliseString,
      );

      if (hasOwn(pricing, "PromotionCodeDiscount")) {
        data.promotionCodeDiscount =
          pricing.PromotionCodeDiscount === null
            ? Prisma.JsonNull
            : jsonValue(pricing.PromotionCodeDiscount);
      }
    }
  }

  assignIfPresent(
    data,
    payload,
    "Distance",
    "distance",
    normaliseDecimal,
  );
  assignIfPresent(
    data,
    payload,
    "SystemDistance",
    "systemDistance",
    normaliseDecimal,
  );
  assignIfPresent(
    data,
    payload,
    "MeterDistance",
    "meterDistance",
    normaliseDecimal,
  );
  assignIfPresent(
    data,
    payload,
    "MeterDistanceAsMetres",
    "meterDistanceMetres",
    normaliseInteger,
  );

  if (hasOwn(payload, "PriceComparison")) {
    const comparison = getObject(payload, "PriceComparison");

    if (!comparison) {
      data.gpsMeterDistance = null;
      data.gpsMeterPrice = null;
      data.gpsMeterPriceSource = null;
      data.estimatedDistance = null;
      data.estimatedPrice = null;
      data.estimatedPriceSource = null;
      data.estimatedTime = null;
    } else {
      assignIfPresent(
        data,
        comparison,
        "GpsMeterDistance",
        "gpsMeterDistance",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        comparison,
        "GpsMeterPrice",
        "gpsMeterPrice",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        comparison,
        "GpsMeterPriceSource",
        "gpsMeterPriceSource",
        normaliseString,
      );
      assignIfPresent(
        data,
        comparison,
        "SystemEstimatedDistance",
        "estimatedDistance",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        comparison,
        "SystemEstimatedPrice",
        "estimatedPrice",
        normaliseDecimal,
      );
      assignIfPresent(
        data,
        comparison,
        "SystemEstimatedPriceSource",
        "estimatedPriceSource",
        normaliseString,
      );
      assignIfPresent(
        data,
        comparison,
        "EstimatedTime",
        "estimatedTime",
        normaliseString,
      );
    }
  }

  if (hasOwn(payload, "Capabilities")) {
    data.capabilities =
      payload.Capabilities === null
        ? Prisma.JsonNull
        : jsonValue(payload.Capabilities);
  }

  if (hasOwn(payload, "YourReferences")) {
    data.yourReferences =
      payload.YourReferences === null
        ? Prisma.JsonNull
        : jsonValue(payload.YourReferences);
  }

  return data as Prisma.BookingUpdateInput;
}

function buildLocationData(
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

async function synchroniseLocation(
  tx: Prisma.TransactionClient,
  bookingId: string,
  payload: JsonObject,
  payloadKey: "Pickup" | "Destination",
  type: LocationType,
): Promise<void> {
  if (!hasOwn(payload, payloadKey)) {
    return;
  }

  const location = getObject(payload, payloadKey);

  if (!location) {
    await tx.bookingLocation.deleteMany({
      where: {
        bookingId,
        type,
      },
    });

    return;
  }

  const data = buildLocationData(location);

  if (!data) {
    return;
  }

  await tx.bookingLocation.upsert({
    where: {
      bookingId_type: {
        bookingId,
        type,
      },
    },
    create: {
      bookingId,
      type,
      ...data,
    },
    update: data,
  });
}

async function synchroniseVias(
  tx: Prisma.TransactionClient,
  bookingId: string,
  payload: JsonObject,
): Promise<void> {
  if (!hasOwn(payload, "Vias")) {
    return;
  }

  const vias = getArray(payload, "Vias");

  await tx.bookingVia.deleteMany({
    where: {
      bookingId,
    },
  });

  if (!vias || vias.length === 0) {
    return;
  }

  const validVias = vias
    .map((via, index) => {
      if (!isObject(via)) {
        return null;
      }

      const data = buildLocationData(via);

      if (!data) {
        return null;
      }

      return {
        bookingId,
        position: index,
        ...data,
      };
    })
    .filter(
      (
        via,
      ): via is {
        bookingId: string;
        position: number;
        address: string;
        zoneId: string | null;
        zoneDescriptor: string | null;
        zoneName: string | null;
        longitude: Prisma.Decimal | null;
        latitude: Prisma.Decimal | null;
      } => via !== null,
    );

  if (validVias.length > 0) {
    await tx.bookingVia.createMany({
      data: validVias,
    });
  }
}

export async function processBookingCreatedWebhook(
  webhookEventId: string,
): Promise<void> {
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: {
      id: webhookEventId,
    },
    select: {
      id: true,
      provider: true,
      eventType: true,
      status: true,
      payload: true,
    },
  });

  if (!webhookEvent) {
    throw new Error(`WebhookEvent not found: ${webhookEventId}`);
  }

  if (webhookEvent.status === "PROCESSED") {
    return;
  }

  if (!isObject(webhookEvent.payload)) {
    throw new Error("Webhook payload is not a JSON object.");
  }

  const payload = webhookEvent.payload;
  const externalId = normaliseString(
    payload.Id ?? payload.BookingId ?? payload.OriginalBookingId,
  );

  if (!externalId) {
    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "FAILED",
        processingError: "Missing Autocab booking ID.",
        attemptCount: {
          increment: 1,
        },
      },
    });

    throw new Error("Missing Autocab booking ID.");
  }

  await prisma.webhookEvent.update({
    where: {
      id: webhookEvent.id,
    },
    data: {
      status: "PROCESSING",
      processingError: null,
      attemptCount: {
        increment: 1,
      },
    },
  });

  try {
    const bookingId = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.upsert({
        where: {
          provider_externalId: {
            provider: "AUTOCAB",
            externalId,
          },
        },
        create: buildBookingCreateData(payload, externalId),
        update: buildBookingUpdateData(payload),
        select: {
          id: true,
        },
      });

      await synchroniseLocation(
        tx,
        booking.id,
        payload,
        "Pickup",
        "PICKUP",
      );

      await synchroniseLocation(
        tx,
        booking.id,
        payload,
        "Destination",
        "DESTINATION",
      );

      await synchroniseVias(tx, booking.id, payload);

      await tx.webhookEvent.update({
        where: {
          id: webhookEvent.id,
        },
        data: {
          externalBookingId: externalId,
          bookingId: booking.id,
          status: "PROCESSED",
          processingError: null,
          processedAt: new Date(),
        },
      });

      return booking.id;
    });

    await createBookingSnapshot({
      bookingId,
      webhookEventId: webhookEvent.id,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown BookingCreated processing error.";

    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "FAILED",
        processingError: message.slice(0, 5000),
      },
    });

    throw error;
  }
}
