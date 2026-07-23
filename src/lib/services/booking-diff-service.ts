type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type BookingDiffItem = {
  field: string;
  oldValue: JsonValue;
  newValue: JsonValue;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compare(
  previous: unknown,
  current: unknown,
  path = "",
  changes: BookingDiffItem[] = [],
): BookingDiffItem[] {
  if (
    previous === null ||
    current === null ||
    typeof previous !== "object" ||
    typeof current !== "object"
  ) {
    if (JSON.stringify(previous) !== JSON.stringify(current)) {
      changes.push({
        field: path || "root",
        oldValue: previous as JsonValue,
        newValue: current as JsonValue,
      });
    }

    return changes;
  }

  if (Array.isArray(previous) || Array.isArray(current)) {
    if (JSON.stringify(previous) !== JSON.stringify(current)) {
      changes.push({
        field: path || "root",
        oldValue: previous as JsonValue,
        newValue: current as JsonValue,
      });
    }

    return changes;
  }

  const previousObject = previous as Record<string, unknown>;
  const currentObject = current as Record<string, unknown>;

  const keys = new Set([
    ...Object.keys(previousObject),
    ...Object.keys(currentObject),
  ]);

  for (const key of Array.from(keys)) {
    const nextPath = path ? `${path}.${key}` : key;

    const previousValue = previousObject[key];
    const currentValue = currentObject[key];

    if (isObject(previousValue) && isObject(currentValue)) {
      compare(previousValue, currentValue, nextPath, changes);
      continue;
    }

    if (JSON.stringify(previousValue) !== JSON.stringify(currentValue)) {
      changes.push({
        field: nextPath,
        oldValue: previousValue as JsonValue,
        newValue: currentValue as JsonValue,
      });
    }
  }

  return changes;
}

export function getBookingDiff(
  previousSnapshot: unknown,
  currentSnapshot: unknown,
): BookingDiffItem[] {
  return compare(previousSnapshot, currentSnapshot);
}
