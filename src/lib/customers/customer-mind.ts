export type CustomerMindTag = {
  label: string;
  category: string;
  percentage: number;
};

export type CustomerMindInput = {
  tags?: CustomerMindTag[];
  rhythm?: {
    rhythmType?: string | null;
    scheduleStatus?: string | null;
    commutePattern?: {
      weekdayPercent?: number | null;
    } | null;
  } | null;
  weather?: {
    tendency?: string | null;
    rainyBookingPercentage?: number | null;
    liftPercent?: number | null;
  } | null;
  contextual?: {
    tendency?: string | null;
    matchedBookingPercentage?: number | null;
  } | null;
  prediction?: {
    needScore?: number | null;
    predictedWindow?: string | null;
    predictedDay?: string | null;
    signalStrength?: string | null;
  } | null;
  need?: {
    level?: string | null;
    actionWindow?: string | null;
  } | null;
  preferences?: {
    preferredBookingStyle?: string | null;
  } | null;
};

export type CustomerMindFact = {
  category: "PLACE" | "TIME" | "WEATHER" | "EVENT" | "RHYTHM" | "NEXT_NEED";
  label: string;
  detail: string;
};

export type CustomerMind = {
  summary: string;
  facts: CustomerMindFact[];
  nextNeed: {
    level: string;
    window: string | null;
    confidence: number | null;
  } | null;
};

const PLACE_LABELS: Record<string, string> = {
  "Pub / Nightlife User": "goes to pubs",
  "Shopping User": "goes shopping",
  "Train Station User": "uses the train station",
  "Airport User": "travels via the airport",
  "Cafe User": "goes to cafés",
  "Restaurant / Dining User": "dines out",
  "Hair & Beauty User": "visits salons",
};

const TIME_LABELS: Record<string, string> = {
  "Early Morning User": "books early mornings",
  "Late Evening User": "books late evenings",
  "Weekend User": "books on weekends",
};

function joinSummary(parts: string[]): string {
  if (parts.length === 0) {
    return "Not enough data yet to read this customer's habits.";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const last = parts[parts.length - 1];
  const rest = parts.slice(0, -1).join(", ");

  return `${rest}, and ${last}.`;
}

export function buildCustomerMind(
  input: CustomerMindInput,
): CustomerMind {
  const facts: CustomerMindFact[] = [];
  const summaryParts: string[] = [];

  // WHERE — place-based behaviour tags.
  const placeTags = (input.tags ?? [])
    .filter((tag) => tag.category === "PLACE")
    .sort((a, b) => b.percentage - a.percentage);

  for (const tag of placeTags.slice(0, 2)) {
    const human = PLACE_LABELS[tag.label] ?? tag.label.toLowerCase();

    facts.push({
      category: "PLACE",
      label: tag.label,
      detail: `${tag.percentage}% of analysed journeys matched this place pattern.`,
    });

    summaryParts.push(human);
  }

  // WHEN — time-based behaviour tags + weekday lean.
  const timeTags = (input.tags ?? [])
    .filter((tag) => tag.category === "TIME")
    .sort((a, b) => b.percentage - a.percentage);

  for (const tag of timeTags.slice(0, 2)) {
    const human = TIME_LABELS[tag.label] ?? tag.label.toLowerCase();

    facts.push({
      category: "TIME",
      label: tag.label,
      detail: `${tag.percentage}% of completed journeys fell into this window.`,
    });

    summaryParts.push(human);
  }

  const weekdayPercent =
    input.rhythm?.commutePattern?.weekdayPercent ?? null;

  if (weekdayPercent !== null) {
    if (weekdayPercent <= 35) {
      facts.push({
        category: "TIME",
        label: "Weekend-leaning",
        detail: `Only ${weekdayPercent}% of this customer's trips happen on weekdays.`,
      });
    } else if (weekdayPercent >= 80) {
      facts.push({
        category: "TIME",
        label: "Weekday-regular",
        detail: `${weekdayPercent}% of trips happen on weekdays, suggesting a routine.`,
      });
    }
  }

  // WEATHER — rain sensitivity.
  const tendency = input.weather?.tendency ?? null;
  const rainyPct =
    input.weather?.rainyBookingPercentage ?? null;
  const liftPercent = input.weather?.liftPercent ?? null;

  if (tendency === "MORE_LIKELY_IN_RAIN") {
    facts.push({
      category: "WEATHER",
      label: "Rain-responsive",
      detail:
        rainyPct !== null
          ? `${rainyPct}% of bookings happened in rain${liftPercent !== null ? ` (+${liftPercent}% vs dry)` : ""}.`
          : "More likely to book when it rains.",
    });
  } else if (tendency === "LESS_LIKELY_IN_RAIN") {
    facts.push({
      category: "WEATHER",
      label: "Dry-weather customer",
      detail: "More likely to book when it's dry.",
    });
  }

  // EVENTS — contextual event responsiveness.
  const contextualTendency =
    input.contextual?.tendency ?? null;

  if (
    contextualTendency === "MORE_ACTIVE_DURING_EVENTS"
  ) {
    facts.push({
      category: "EVENT",
      label: "Event-driven",
      detail: "Books more during local events.",
    });
  } else if (
    contextualTendency === "LESS_ACTIVE_DURING_EVENTS"
  ) {
    facts.push({
      category: "EVENT",
      label: "Avoids event periods",
      detail: "Books less during local events.",
    });
  }

  // NEXT NEED — when they'll likely need a taxi next.
  const needLevel = input.need?.level ?? null;
  const needScore = input.prediction?.needScore ?? null;
  const predictedWindow =
    input.prediction?.predictedWindow ?? null;
  const signalStrength =
    input.prediction?.signalStrength ?? null;

  let nextNeed: CustomerMind["nextNeed"] = null;

  if (needLevel && needLevel !== "LEARNING" && needLevel !== "DISABLED") {
    facts.push({
      category: "NEXT_NEED",
      label: `Need level: ${needLevel.toLowerCase()}`,
      detail: predictedWindow
        ? `Most likely to need a taxi: ${predictedWindow}.`
        : "Elevated likelihood of needing a taxi soon.",
    });

    nextNeed = {
      level: needLevel.toLowerCase(),
      window: predictedWindow,
      confidence:
        typeof needScore === "number" ? needScore : null,
    };

    if (predictedWindow) {
      summaryParts.push(
        `likely needs a taxi ${predictedWindow.toLowerCase()}`,
      );
    }
  }

  const summary = joinSummary(summaryParts);

  return {
    summary,
    facts,
    nextNeed,
  };
}
