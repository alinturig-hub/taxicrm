import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PROCESSING_MODES = [
  "ALWAYS",
  "WHEN_CONDITIONS_MATCH",
] as const;

const CONDITION_MODES = [
  "ALL",
  "ANY",
] as const;

const CONDITION_OPERATORS = [
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "NOT_CONTAINS",
  "EXISTS",
  "NOT_EXISTS",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUALS",
  "LESS_THAN",
  "LESS_THAN_OR_EQUALS",
  "IN",
  "NOT_IN",
] as const;

type ProcessingMode = (typeof PROCESSING_MODES)[number];
type ConditionMode = (typeof CONDITION_MODES)[number];
type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

type ConditionInput = {
  fieldPath: string;
  operator: ConditionOperator;
  expectedValue?: string | number | boolean | string[] | number[];
  position?: number;
  isEnabled?: boolean;
};

type CreateWebhookInput = {
  displayName: string;
  eventType: string;
  endpointSlug: string;
  description?: string | null;
  isEnabled?: boolean;
  processingMode?: ProcessingMode;
  conditionMode?: ConditionMode;
  conditions?: ConditionInput[];
};

function isProcessingMode(value: unknown): value is ProcessingMode {
  return (
    typeof value === "string" &&
    PROCESSING_MODES.includes(value as ProcessingMode)
  );
}

function isConditionMode(value: unknown): value is ConditionMode {
  return (
    typeof value === "string" &&
    CONDITION_MODES.includes(value as ConditionMode)
  );
}

function isConditionOperator(value: unknown): value is ConditionOperator {
  return (
    typeof value === "string" &&
    CONDITION_OPERATORS.includes(value as ConditionOperator)
  );
}

function normalizeEventType(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeEndpointSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

export async function GET() {
  try {
    const configurations =
      await prisma.autocabWebhookConfiguration.findMany({
        orderBy: [
          {
            isEnabled: "desc",
          },
          {
            displayName: "asc",
          },
        ],
      });

    const conditionCounts = await prisma.webhookCondition.groupBy({
      by: ["configurationId"],
      _count: {
        _all: true,
      },
    });

    const countsByConfigurationId = new Map(
      conditionCounts.map((item) => [
        item.configurationId,
        item._count._all,
      ]),
    );

    const response = configurations.map((configuration) => ({
      ...configuration,
      conditionCount:
        countsByConfigurationId.get(configuration.id) ?? 0,
      endpointUrl: `/api/webhooks/autocab/${configuration.endpointSlug}`,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Failed to load Autocab webhook configurations:",
      error,
    );

    return NextResponse.json(
      {
        error: "WEBHOOK_CONFIGURATIONS_LOAD_FAILED",
        message:
          "Autocab webhook configurations could not be loaded.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<CreateWebhookInput>;

    const displayName =
      typeof body.displayName === "string"
        ? body.displayName.trim()
        : "";

    const eventType =
      typeof body.eventType === "string"
        ? normalizeEventType(body.eventType)
        : "";

    const endpointSlug =
      typeof body.endpointSlug === "string"
        ? normalizeEndpointSlug(body.endpointSlug)
        : "";

    if (!displayName) {
      return NextResponse.json(
        {
          error: "DISPLAY_NAME_REQUIRED",
          message: "Display name is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!eventType) {
      return NextResponse.json(
        {
          error: "EVENT_TYPE_REQUIRED",
          message: "Event type is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!endpointSlug) {
      return NextResponse.json(
        {
          error: "ENDPOINT_SLUG_REQUIRED",
          message: "Endpoint slug is required.",
        },
        {
          status: 400,
        },
      );
    }

    const processingMode = isProcessingMode(
      body.processingMode,
    )
      ? body.processingMode
      : "ALWAYS";

    const conditionMode = isConditionMode(body.conditionMode)
      ? body.conditionMode
      : "ALL";

    const conditions = Array.isArray(body.conditions)
      ? body.conditions
      : [];

    for (const condition of conditions) {
      if (
        !condition ||
        typeof condition.fieldPath !== "string" ||
        !condition.fieldPath.trim()
      ) {
        return NextResponse.json(
          {
            error: "INVALID_CONDITION_FIELD",
            message:
              "Every condition must contain a field path.",
          },
          {
            status: 400,
          },
        );
      }

      if (!isConditionOperator(condition.operator)) {
        return NextResponse.json(
          {
            error: "INVALID_CONDITION_OPERATOR",
            message:
              "One or more webhook condition operators are invalid.",
          },
          {
            status: 400,
          },
        );
      }
    }

    if (
      processingMode === "WHEN_CONDITIONS_MATCH" &&
      conditions.length === 0
    ) {
      return NextResponse.json(
        {
          error: "CONDITIONS_REQUIRED",
          message:
            "At least one condition is required when conditional processing is enabled.",
        },
        {
          status: 400,
        },
      );
    }

    const configuration = await prisma.$transaction(
      async (transaction) => {
        const created =
          await transaction.autocabWebhookConfiguration.create({
            data: {
              displayName,
              eventType,
              endpointSlug,
              description:
                typeof body.description === "string" &&
                body.description.trim()
                  ? body.description.trim()
                  : null,
              isEnabled:
                typeof body.isEnabled === "boolean"
                  ? body.isEnabled
                  : true,
              processingMode,
              conditionMode,
            },
          });

        if (conditions.length > 0) {
          await transaction.webhookCondition.createMany({
            data: conditions.map((condition, index) => ({
              configurationId: created.id,
              fieldPath: condition.fieldPath.trim(),
              operator: condition.operator,
              ...(condition.expectedValue !== undefined
                ? {
                    expectedValue: condition.expectedValue,
                  }
                : {}),
              position:
                typeof condition.position === "number"
                  ? condition.position
                  : index,
              isEnabled:
                typeof condition.isEnabled === "boolean"
                  ? condition.isEnabled
                  : true,
            })),
          });
        }

        return created;
      },
    );

    return NextResponse.json(
      {
        ...configuration,
        conditionCount: conditions.length,
        endpointUrl: `/api/webhooks/autocab/${configuration.endpointSlug}`,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "Failed to create Autocab webhook configuration:",
      error,
    );

    if (getPrismaErrorCode(error) === "P2002") {
      return NextResponse.json(
        {
          error: "WEBHOOK_CONFIGURATION_ALREADY_EXISTS",
          message:
            "A webhook with this event type or endpoint slug already exists.",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json(
      {
        error: "WEBHOOK_CONFIGURATION_CREATE_FAILED",
        message:
          "The Autocab webhook configuration could not be created.",
      },
      {
        status: 500,
      },
    );
  }
}
