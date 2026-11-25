const freephonePeriods = ["today", "yesterday", "this week", "last week", "this month", "last month"] as const;
export type FreephonePeriod = typeof freephonePeriods[number];

const freephone = /\bfree[ -]?phone\b/i;

export function bookingScope(question: string, checkOtherBookingFilters = true) {
  // Route scoped questions before the company-wide analytics planner.
  if (!freephone.test(question) &&
      (!checkOtherBookingFilters ||
        !/\b(?:bookings?|jobs)\s+(?:from|for|via|at|by|on|in|with|without|through|where)\b/i.test(question))) {
    return null;
  }

  const match = question.trim().match(
    /^(?:how many\s+)?bookings?\s+(?:did\s+we\s+have\s+)?(?:from|for|via|on)\s+(.+?)(?:\s+did\s+we\s+have|\s+we\s+had)?\s+(today|yesterday|(?:this|last|current) (?:week|month))(?:\s+so far)?[?.!]*$/i,
  );
  const name = match?.[1].trim();
  if (!name || !freephone.test(name)) return { type: "clarify" } as const;

  const line = name.replace(/\bfree[ -]?phone\b/gi, "").trim();
  if (!line || /\b(?:and|or|excluding|except|only|between|since|before|after|completed|cancelled|canceled|cash|card)\b|[,;?]/i.test(line)) {
    return { type: "clarify" } as const;
  }

  const period = freephonePeriods.find((value) => value === match?.[2].toLowerCase().replace("current", "this"));
  return period ? { type: "freephone", line, period } as const : { type: "clarify" } as const;
}

export function normalizeLine(name: string) {
  return name.normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bfree[ -]?phone\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchingFreephoneLines<T extends { name: string }>(lines: T[], name: string): T[] {
  const wanted = normalizeLine(name);
  if (!wanted) return [];
  const exact = lines.filter((line) => normalizeLine(line.name) === wanted);
  return exact.length ? exact : lines.filter((line) => ` ${normalizeLine(line.name)} `.includes(` ${wanted} `));
}
