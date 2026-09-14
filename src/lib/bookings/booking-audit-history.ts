import { prisma } from "@/lib/prisma";

export type BookingAuditDriver = {
  id: string | null;
  callsign: string | null;
  name: string;
};

export type RejectionClassification =
  | "EFFECTIVE"
  | "DUPLICATE"
  | "RECOVERED"
  | "UNATTRIBUTED";

export type BookingAuditEvent = {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  source: string;
  occurredAt: string;
  category:
    | "BOOKING"
    | "OFFER"
    | "REJECTION"
    | "ACCEPTANCE"
    | "STATUS";
  driver: BookingAuditDriver | null;
  rejectionClassification:
    RejectionClassification | null;
  rawAttemptNumber: number | null;
};

type ExistingTimelineEvent = {
  id: string;
  webhookEventId: string | null;
  eventType: string;
  title: string;
  description: string | null;
  source: string;
  occurredAt: Date;
};

type DriverReference = {
  id: string | null;
  callsign: string | null;
  forename: string | null;
  surname: string | null;
};

type AttributedEvent = {
  driver: DriverReference | null;
  offerWebhookId: string | null;
};

type RejectionEvent = {
  webhookId: string;
  occurredAt: Date;
  driver: DriverReference | null;
  attemptNumber: number | null;
};

type AcceptanceEvent = {
  occurredAt: Date;
  driver: DriverReference | null;
};

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textValue(
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value =
      record[key];

    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return String(value);
    }
  }

  return null;
}

function driverFromPayload(
  payload: unknown,
): DriverReference | null {
  const payloadRecord =
    asRecord(payload);

  const driver =
    asRecord(
      payloadRecord?.Driver ??
      payloadRecord?.driver,
    );

  if (!driver) {
    return null;
  }

  const reference = {
    id:
      textValue(
        driver,
        "Id",
        "ID",
        "id",
      ),
    callsign:
      textValue(
        driver,
        "Callsign",
        "CallSign",
        "callsign",
      ),
    forename:
      textValue(
        driver,
        "Forename",
        "FirstName",
        "forename",
      ),
    surname:
      textValue(
        driver,
        "Surname",
        "LastName",
        "surname",
      ),
  };

  return reference.id ||
    reference.callsign
    ? reference
    : null;
}

function auditDriver(
  driver: DriverReference | null,
): BookingAuditDriver | null {
  if (!driver) {
    return null;
  }

  const name =
    [
      driver.forename,
      driver.surname,
    ]
      .filter(Boolean)
      .join(" ") ||
    driver.callsign ||
    driver.id ||
    "Unknown Driver";

  return {
    id:
      driver.id,
    callsign:
      driver.callsign,
    name,
  };
}

function driverLabel(
  driver: DriverReference | null,
) {
  const value =
    auditDriver(driver);

  if (!value) {
    return "unknown driver";
  }

  return [
    value.callsign
      ? `#${value.callsign}`
      : null,
    value.name,
  ]
    .filter(Boolean)
    .join(" · ");
}

function humanizeEventType(
  eventType: string,
) {
  return eventType
    .replace(
      /([a-z0-9])([A-Z])/g,
      "$1 $2",
    )
    .replace(/_/g, " ")
    .trim();
}

function eventCategory(
  eventType: string,
) {
  const normalized =
    eventType.toLowerCase();

  if (
    normalized.includes(
      "rejected",
    )
  ) {
    return "REJECTION" as const;
  }

  if (
    normalized.includes(
      "accepted",
    )
  ) {
    return "ACCEPTANCE" as const;
  }

  if (
    normalized.includes(
      "completed",
    ) ||
    normalized.includes(
      "cancelled",
    ) ||
    normalized.includes(
      "canceled",
    ) ||
    normalized.includes(
      "arrived",
    ) ||
    normalized.includes(
      "pob",
    ) ||
    normalized.includes(
      "passenger",
    ) ||
    normalized.includes(
      "nofare",
    ) ||
    normalized.includes(
      "no_fare",
    )
  ) {
    return "STATUS" as const;
  }

  return "BOOKING" as const;
}

export async function getBookingAuditHistory({
  externalBookingId,
  finalDriver,
  timelineEvents,
}: {
  externalBookingId: string;
  finalDriver: DriverReference | null;
  timelineEvents: ExistingTimelineEvent[];
}): Promise<BookingAuditEvent[]> {
  const webhookEvents =
    await prisma.webhookEvent.findMany({
      where: {
        provider:
          "AUTOCAB",
        externalBookingId,
        status:
          "PROCESSED",
      },
      orderBy: [
        {
          receivedAt:
            "asc",
        },
        {
          id:
            "asc",
        },
      ],
      select: {
        id: true,
        eventType: true,
        payload: true,
        receivedAt: true,
      },
    });

  const attributionByWebhookId =
    new Map<
      string,
      AttributedEvent
    >();

  const rejectionByWebhookId =
    new Map<
      string,
      RejectionEvent
    >();

  const acceptanceEvents:
    AcceptanceEvent[] = [];

  const usedOfferWebhookIds =
    new Set<string>();

  const rejectionAttemptsByDriver =
    new Map<string, number>();

  let currentDriver:
    DriverReference | null =
      null;

  let currentOfferWebhookId:
    string | null =
      null;

  for (const event of webhookEvents) {
    if (
      event.eventType ===
      "BookingModified"
    ) {
      const payloadDriver =
        driverFromPayload(
          event.payload,
        );

      if (payloadDriver) {
        currentDriver =
          payloadDriver;
        currentOfferWebhookId =
          event.id;
      }
    }

    if (
      event.eventType ===
      "BookingRejected"
    ) {
      const driver =
        currentDriver
          ? {
              ...currentDriver,
            }
          : null;

      const driverKey =
        driver?.id ??
        driver?.callsign ??
        null;

      const attemptNumber =
        driverKey
          ? (
              rejectionAttemptsByDriver.get(
                driverKey,
              ) ??
              0
            ) +
            1
          : null;

      if (
        driverKey &&
        attemptNumber
      ) {
        rejectionAttemptsByDriver.set(
          driverKey,
          attemptNumber,
        );
      }

      attributionByWebhookId.set(
        event.id,
        {
          driver,
          offerWebhookId:
            currentOfferWebhookId,
        },
      );

      rejectionByWebhookId.set(
        event.id,
        {
          webhookId:
            event.id,
          occurredAt:
            event.receivedAt,
          driver,
          attemptNumber,
        },
      );

      if (currentOfferWebhookId) {
        usedOfferWebhookIds.add(
          currentOfferWebhookId,
        );
      }
    }

    if (
      event.eventType ===
      "BookingDispatchAccepted"
    ) {
      const driver =
        currentDriver
          ? {
              ...currentDriver,
            }
          : null;

      attributionByWebhookId.set(
        event.id,
        {
          driver,
          offerWebhookId:
            currentOfferWebhookId,
        },
      );

      acceptanceEvents.push({
        occurredAt:
          event.receivedAt,
        driver,
      });

      if (currentOfferWebhookId) {
        usedOfferWebhookIds.add(
          currentOfferWebhookId,
        );
      }
    }
  }

  const latestRejectionByDriver =
    new Map<
      string,
      RejectionEvent
    >();

  for (
    const rejection
    of Array.from(
rejectionByWebhookId.values()
)
  ) {
    const driverKey =
      rejection.driver?.id ??
      rejection.driver?.callsign;

    if (driverKey) {
      latestRejectionByDriver.set(
        driverKey,
        rejection,
      );
    }
  }

  const classificationByWebhookId =
    new Map<
      string,
      RejectionClassification
    >();

  for (
    const rejection
    of Array.from(
rejectionByWebhookId.values()
)
  ) {
    const driverKey =
      rejection.driver?.id ??
      rejection.driver?.callsign;

    if (!driverKey) {
      classificationByWebhookId.set(
        rejection.webhookId,
        "UNATTRIBUTED",
      );
      continue;
    }

    const latest =
      latestRejectionByDriver.get(
        driverKey,
      );

    if (
      latest?.webhookId !==
      rejection.webhookId
    ) {
      classificationByWebhookId.set(
        rejection.webhookId,
        "DUPLICATE",
      );
      continue;
    }

    const recovered =
      acceptanceEvents.some(
        (acceptance) => {
          const acceptedDriverKey =
            acceptance.driver?.id ??
            acceptance.driver?.callsign;

          return (
            acceptedDriverKey ===
              driverKey &&
            acceptance.occurredAt >
              rejection.occurredAt
          );
        },
      );

    classificationByWebhookId.set(
      rejection.webhookId,
      recovered
        ? "RECOVERED"
        : "EFFECTIVE",
    );
  }

  const timelineByWebhookId =
    new Map(
      timelineEvents
        .filter(
          (event) =>
            event.webhookEventId,
        )
        .map(
          (event) => [
            event.webhookEventId as string,
            event,
          ],
        ),
    );

  const history:
    BookingAuditEvent[] = [];

  for (const webhook of webhookEvents) {
    const existing =
      timelineByWebhookId.get(
        webhook.id,
      );

    const attribution =
      attributionByWebhookId.get(
        webhook.id,
      );

    const rejection =
      rejectionByWebhookId.get(
        webhook.id,
      );

    const classification =
      classificationByWebhookId.get(
        webhook.id,
      ) ??
      null;

    const normalized = [
      webhook.eventType,
      existing?.eventType,
      existing?.title,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    let title =
      existing?.title ??
      humanizeEventType(
        webhook.eventType,
      );

    let description =
      existing?.description ??
      null;

    let category:
      BookingAuditEvent["category"] =
      eventCategory(
        webhook.eventType,
      );

    let driver =
      attribution?.driver ??
      null;

    if (
      usedOfferWebhookIds.has(
        webhook.id,
      )
    ) {
      driver =
        driverFromPayload(
          webhook.payload,
        );

      title =
        `Job offered to ${driverLabel(
          driver,
        )}`;

      description =
        "Driver assignment recorded before the dispatch response.";

      category =
        "OFFER";
    }

    if (
      webhook.eventType ===
      "BookingRejected"
    ) {
      title =
        attribution?.driver
          ? `Rejected by ${driverLabel(
              attribution.driver,
            )}`
          : "Driver rejection received";

      description =
        classification ===
        "EFFECTIVE"
          ? `Raw rejection attempt ${rejection?.attemptNumber ?? 1} for this driver · Counts once as an effective rejection.`
          : classification ===
              "DUPLICATE"
            ? `Raw rejection attempt ${rejection?.attemptNumber ?? 1} for this driver · Duplicate attempt, not counted again.`
            : classification ===
                "RECOVERED"
              ? `Raw rejection attempt ${rejection?.attemptNumber ?? 1} for this driver · Recovered because the same driver later accepted.`
              : "No preceding driver assignment was available for attribution.";

      category =
        "REJECTION";
    }

    if (
      webhook.eventType ===
      "BookingDispatchAccepted"
    ) {
      title =
        attribution?.driver
          ? `Accepted by ${driverLabel(
              attribution.driver,
            )}`
          : "Dispatch accepted";

      description =
        "The driver accepted the job offer.";

      category =
        "ACCEPTANCE";
    }

    if (
      normalized.includes(
        "completed",
      )
    ) {
      driver =
        finalDriver;

      title =
        finalDriver
          ? `Completed by ${driverLabel(
              finalDriver,
            )}`
          : "Booking completed";

      description =
        "Final completed outcome recorded.";

      category =
        "STATUS";
    }

    if (
      normalized.includes(
        "cancelled",
      ) ||
      normalized.includes(
        "canceled",
      )
    ) {
      title =
        "Booking cancelled";
      description =
        finalDriver
          ? `Final assigned driver: ${driverLabel(
              finalDriver,
            )}.`
          : "Booking cancelled without a final driver.";

      category =
        "STATUS";
    }

    if (
      normalized.includes(
        "nofare",
      ) ||
      normalized.includes(
        "no_fare",
      ) ||
      normalized.includes(
        "no fare",
      )
    ) {
      driver =
        finalDriver;

      title =
        finalDriver
          ? `No Fare recorded for ${driverLabel(
              finalDriver,
            )}`
          : "No Fare recorded";

      category =
        "STATUS";
    }

    history.push({
      id:
        existing?.id ??
        `webhook:${webhook.id}`,
      eventType:
        webhook.eventType,
      title,
      description,
      source:
        existing?.source ??
        "AUTOCAB",
      occurredAt:
        webhook.receivedAt.toISOString(),
      category,
      driver:
        auditDriver(driver),
      rejectionClassification:
        classification,
      rawAttemptNumber:
        rejection?.attemptNumber ??
        null,
    });
  }

  for (const event of timelineEvents) {
    if (
      event.webhookEventId &&
      webhookEvents.some(
        (webhook) =>
          webhook.id ===
          event.webhookEventId,
      )
    ) {
      continue;
    }

    history.push({
      id:
        event.id,
      eventType:
        event.eventType,
      title:
        event.title,
      description:
        event.description,
      source:
        event.source,
      occurredAt:
        event.occurredAt.toISOString(),
      category:
        eventCategory(
          event.eventType,
        ),
      driver:
        null,
      rejectionClassification:
        null,
      rawAttemptNumber:
        null,
    });
  }

  history.sort(
    (left, right) =>
      new Date(
        left.occurredAt,
      ).getTime() -
        new Date(
          right.occurredAt,
        ).getTime() ||
      left.id.localeCompare(
        right.id,
      ),
  );

  return history;
}
