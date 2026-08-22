import { createHash } from "crypto";

import { prisma } from "@/lib/prisma";

export const EVENT_CATEGORIES = [
  "PUBLIC_HOLIDAY",
  "SPORT",
  "UNIVERSITY",
  "TRANSPORT",
  "COMMUNITY",
  "CONCERT",
  "OTHER",
] as const;

export const EVENT_IMPACT_LEVELS = [
  "LOW",
  "MEDIUM",
  "HIGH",
] as const;

type EventCategory =
  (typeof EVENT_CATEGORIES)[number];

type EventImpactLevel =
  (typeof EVENT_IMPACT_LEVELS)[number];

export type EventImportInput = {
  externalId?: unknown;
  title?: unknown;
  category?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  locationName?: unknown;
  description?: unknown;
  impactLevel?: unknown;
  sourceUrl?: unknown;
  active?: unknown;
};

export type ValidatedEvent = {
  externalId: string;
  title: string;
  category: EventCategory;
  startsAt: Date;
  endsAt: Date;
  locationName: string | null;
  description: string | null;
  impactLevel: EventImpactLevel;
  sourceUrl: string | null;
  active: boolean;
};

export type EventImportError = {
  row: number;
  message: string;
};

const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function optionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  return result.length > 0 ? result : null;
}

function requiredText(
  value: unknown,
  field: string,
) {
  const result = optionalText(value);

  if (!result) {
    throw new Error(`${field} is required.`);
  }

  return result;
}

function londonOffsetMilliseconds(date: Date) {
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    },
  );

  const parts = formatter.formatToParts(date);

  const part = (type: string) =>
    Number(
      parts.find((item) => item.type === type)
        ?.value ?? 0,
    );

  const representedAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );

  return representedAsUtc - date.getTime();
}

function localLondonDateTime(value: string) {
  const match = DATE_TIME_PATTERN.exec(
    value.trim(),
  );

  if (!match) {
    throw new Error(
      "Expected YYYY-MM-DD HH:mm or an ISO date.",
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);

  const targetAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
  );

  const validation = new Date(targetAsUtc);

  if (
    validation.getUTCFullYear() !== year ||
    validation.getUTCMonth() + 1 !== month ||
    validation.getUTCDate() !== day ||
    validation.getUTCHours() !== hour ||
    validation.getUTCMinutes() !== minute ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new Error("Invalid calendar date.");
  }

  let result = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt++) {
    result =
      targetAsUtc -
      londonOffsetMilliseconds(
        new Date(result),
      );
  }

  return new Date(result);
}

function parseEventDate(
  value: unknown,
  field: string,
) {
  const text = requiredText(value, field);

  if (DATE_TIME_PATTERN.test(text)) {
    return localLondonDateTime(text);
  }

  const parsed = new Date(text);

  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${field} is invalid.`);
  }

  return parsed;
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return true;
  }

  return ![
    "false",
    "0",
    "no",
    "inactive",
  ].includes(value.trim().toLowerCase());
}

function stableExternalId(
  event: Omit<ValidatedEvent, "externalId">,
) {
  return createHash("sha256")
    .update(
      [
        event.title.toLowerCase(),
        event.category,
        event.startsAt.toISOString(),
        event.endsAt.toISOString(),
        event.locationName?.toLowerCase() ?? "",
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
}

export function validateEvent(
  input: EventImportInput,
): ValidatedEvent {
  const title = requiredText(
    input.title,
    "title",
  );

  if (title.length > 250) {
    throw new Error(
      "title must not exceed 250 characters.",
    );
  }

  const categoryValue = requiredText(
    input.category,
    "category",
  ).toUpperCase();

  if (
    !EVENT_CATEGORIES.includes(
      categoryValue as EventCategory,
    )
  ) {
    throw new Error(
      `category must be one of: ${EVENT_CATEGORIES.join(", ")}.`,
    );
  }

  const impactValue = (
    optionalText(input.impactLevel) ?? "MEDIUM"
  ).toUpperCase();

  if (
    !EVENT_IMPACT_LEVELS.includes(
      impactValue as EventImpactLevel,
    )
  ) {
    throw new Error(
      "impactLevel must be LOW, MEDIUM or HIGH.",
    );
  }

  const startsAt = parseEventDate(
    input.startsAt,
    "startsAt",
  );

  const endsAt = parseEventDate(
    input.endsAt,
    "endsAt",
  );

  if (endsAt <= startsAt) {
    throw new Error(
      "endsAt must be later than startsAt.",
    );
  }

  const sourceUrl = optionalText(
    input.sourceUrl,
  );

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(
        "sourceUrl must be a valid HTTP or HTTPS URL.",
      );
    }
  }

  const base = {
    title,
    category:
      categoryValue as EventCategory,
    startsAt,
    endsAt,
    locationName: optionalText(
      input.locationName,
    ),
    description: optionalText(
      input.description,
    ),
    impactLevel:
      impactValue as EventImpactLevel,
    sourceUrl,
    active: parseBoolean(input.active),
  };

  return {
    externalId:
      optionalText(input.externalId) ??
      stableExternalId(base),
    ...base,
  };
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const text = csv.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index++) {
    const character = text[index];

    if (quoted) {
      if (
        character === '"' &&
        text[index + 1] === '"'
      ) {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (
      character === "\n" ||
      character === "\r"
    ) {
      if (
        character === "\r" &&
        text[index + 1] === "\n"
      ) {
        index++;
      }

      row.push(field.trim());
      field = "";

      if (
        row.some((value) => value.length > 0)
      ) {
        rows.push(row);
      }

      row = [];
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error(
      "CSV contains an unclosed quoted value.",
    );
  }

  row.push(field.trim());

  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

export function parseEventCsv(csv: string) {
  const rows = parseCsvRows(csv);

  if (rows.length < 2) {
    throw new Error(
      "CSV must contain a header and at least one event.",
    );
  }

  const headers = rows[0].map((header) =>
    header.trim(),
  );

  const requiredHeaders = [
    "title",
    "category",
    "startsAt",
    "endsAt",
  ];

  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      throw new Error(
        `CSV is missing required column: ${required}.`,
      );
    }
  }

  const events: ValidatedEvent[] = [];
  const errors: EventImportError[] = [];

  rows.slice(1).forEach((values, index) => {
    const input: Record<string, string> = {};

    headers.forEach((header, column) => {
      input[header] = values[column] ?? "";
    });

    try {
      events.push(validateEvent(input));
    } catch (error) {
      errors.push({
        row: index + 2,
        message:
          error instanceof Error
            ? error.message
            : "Invalid event.",
      });
    }
  });

  return {
    events,
    errors,
    totalRows: rows.length - 1,
  };
}

export async function saveContextualEvents(
  events: ValidatedEvent[],
  source: string,
) {
  let created = 0;
  let updated = 0;

  for (const event of events) {
    const existing =
      await prisma.contextualCalendarEvent.findUnique({
        where: {
          source_externalId: {
            source,
            externalId: event.externalId,
          },
        },
        select: {
          id: true,
        },
      });

    await prisma.contextualCalendarEvent.upsert({
      where: {
        source_externalId: {
          source,
          externalId: event.externalId,
        },
      },
      create: {
        ...event,
        source,
      },
      update: {
        title: event.title,
        category: event.category,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        locationName: event.locationName,
        description: event.description,
        impactLevel: event.impactLevel,
        sourceUrl: event.sourceUrl,
        active: event.active,
      },
    });

    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  return {
    created,
    updated,
    saved: created + updated,
  };
}
