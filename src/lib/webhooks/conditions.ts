import {
  WebhookConditionMode,
  WebhookConditionOperator,
} from "@/generated/prisma/enums";

export interface WebhookConditionRecord {
  id: string;
  configurationId: string;
  fieldPath: string;
  operator: WebhookConditionOperator;
  expectedValue: string | null;
  position: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConditionEvaluationResult {
  matched: boolean;
  failedCondition: WebhookConditionRecord | null;
}

function getValue(
  payload: Record<string, unknown>,
  path: string,
): unknown {
  return path
    .split(".")
    .reduce<unknown>((current, key) => {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, payload);
}

function evaluateCondition(
  payload: Record<string, unknown>,
  condition: WebhookConditionRecord,
): boolean {
  const value = getValue(payload, condition.fieldPath);
  const expected = condition.expectedValue;

  switch (condition.operator) {
    case WebhookConditionOperator.EXISTS:
      return value !== undefined && value !== null;

    case WebhookConditionOperator.NOT_EXISTS:
      return value === undefined || value === null;

    case WebhookConditionOperator.EQUALS:
      return String(value ?? "") === String(expected ?? "");

    case WebhookConditionOperator.NOT_EQUALS:
      return String(value ?? "") !== String(expected ?? "");

    case WebhookConditionOperator.CONTAINS:
      return String(value ?? "").includes(String(expected ?? ""));

    case WebhookConditionOperator.NOT_CONTAINS:
      return !String(value ?? "").includes(String(expected ?? ""));

    case WebhookConditionOperator.GREATER_THAN:
      return Number(value) > Number(expected);

    case WebhookConditionOperator.GREATER_THAN_OR_EQUALS:
      return Number(value) >= Number(expected);

    case WebhookConditionOperator.LESS_THAN:
      return Number(value) < Number(expected);

    case WebhookConditionOperator.LESS_THAN_OR_EQUALS:
      return Number(value) <= Number(expected);

    case WebhookConditionOperator.IN:
      return String(expected ?? "")
        .split(",")
        .map((v) => v.trim())
        .includes(String(value));

    case WebhookConditionOperator.NOT_IN:
      return !String(expected ?? "")
        .split(",")
        .map((v) => v.trim())
        .includes(String(value));

    default:
      return false;
  }
}

export function evaluateConditions(
  payload: Record<string, unknown>,
  conditions: WebhookConditionRecord[],
  mode: WebhookConditionMode,
): ConditionEvaluationResult {
  if (conditions.length === 0) {
    return {
      matched: true,
      failedCondition: null,
    };
  }

  if (mode === WebhookConditionMode.ALL) {
    for (const condition of conditions) {
      if (!evaluateCondition(payload, condition)) {
        return {
          matched: false,
          failedCondition: condition,
        };
      }
    }

    return {
      matched: true,
      failedCondition: null,
    };
  }

  for (const condition of conditions) {
    if (evaluateCondition(payload, condition)) {
      return {
        matched: true,
        failedCondition: null,
      };
    }
  }

  return {
    matched: false,
    failedCondition: conditions[0],
  };
}
