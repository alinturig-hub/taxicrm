const freephone = /\bfree[ -]?phone\b/i;

export function bookingScope(question: string, checkOtherBookingFilters = true) {
  // Route scoped questions before the company-wide analytics planner.
  if (!freephone.test(question) &&
      (!checkOtherBookingFilters ||
        !/\b(?:bookings?|jobs)\s+(?:from|for|via|at|by|on|in|with|without|through|where)\b/i.test(question))) {
    return null;
  }

  const match = question.trim().match(
    /^(?:how many\s+)?bookings?\s+(?:from|for|via|on)\s+(.+?)(?:\s+did\s+we\s+have|\s+we\s+had)?\s+(?:this|current) week(?:\s+so far)?[?.!]*$/i,
  );
  const name = match?.[1].trim();
  if (!name || !freephone.test(name)) return { type: "clarify" } as const;

  const line = name.replace(/\bfree[ -]?phone\b/gi, "").trim();
  if (!line || /\b(?:and|or|excluding|except|only|between|since|before|after|completed|cancelled|canceled|cash|card)\b|[,;?]/i.test(line)) {
    return { type: "clarify" } as const;
  }

  return { type: "freephone", line } as const;
}

function normalizeLine(name: string) {
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
