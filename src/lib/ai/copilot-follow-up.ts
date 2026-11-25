import type { AnalyticsPeriod } from "./analytics-query-engine";

// Only accept an unambiguous, standalone period follow-up. Longer or
// unrelated questions must be interpreted independently by the existing flow.
export function followUpPeriod(question: string): AnalyticsPeriod | null {
  const normalized = question.trim().toLocaleLowerCase("ro").replace(/[?!.]+$/, "").trim();
  const periods: Array<[RegExp, AnalyticsPeriod]> = [
    [/^(?:(?:și|si|iar|dar|and|what about)\s+)?(?:ieri|yesterday)$/, "YESTERDAY"],
    [/^(?:(?:și|si|iar|dar|and|what about)\s+)?(?:azi|astăzi|astazi|today)$/, "TODAY"],
    [/^(?:(?:și|si|iar|dar|and|what about)\s+)?(?:săptămâna trecută|saptamana trecuta|last week)$/, "LAST_WEEK"],
    [/^(?:(?:și|si|iar|dar|and|what about)\s+)?(?:săptămâna aceasta|saptamana aceasta|this week)$/, "THIS_WEEK"],
    [/^(?:(?:și|si|iar|dar|and|what about)\s+)?(?:luna trecută|luna trecuta|last month)$/, "LAST_MONTH"],
    [/^(?:(?:și|si|iar|dar|and|what about)\s+)?(?:luna aceasta|this month)$/, "THIS_MONTH"],
  ];
  return periods.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

export function companyNoShowPeriod(question: string) {
  const explicitCompany = /\s+(?:across the (?:whole |entire )?company|for the (?:whole |entire )?company|company-wide)(?=\s|[?.!]*$)/i;
  return explicitCompany.test(question) ? freephoneNoShowFollowUp(question.replace(explicitCompany, "")) : null;
}

export function freephoneNoShowFollowUp(question: string) {
  const match = question.trim().match(
    /^(?:(?:perfect|perdect|thanks)[, ]+)?(?:and\s+)?(?:(?:how|hao) many\s+)?(?:no[ -]shows?|no[ -]fares?)(?:\s+(?:did we have|we had))?\s+(today|yesterday|this week|last week|this month|last month)[?.!]*$/i,
  );
  return match ? match[1].toLowerCase() as import("./copilot-booking-scope").FreephonePeriod : null;
}
