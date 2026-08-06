const LONDON_TIME_ZONE = "Europe/London";

type LondonDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
};

function getLondonDateParts(
  date: Date,
): LondonDateParts {
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: LONDON_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    },
  );

  const parts = formatter.formatToParts(date);

  const getPart = (type: string): string => {
    return (
      parts.find((part) => part.type === type)
        ?.value ?? ""
    );
  };

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day")),
    weekday: weekdayMap[getPart("weekday")] ?? 0,
  };
}

function getTimeZoneOffsetMilliseconds(
  date: Date,
): number {
  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: LONDON_TIME_ZONE,
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

  const getPart = (type: string): number => {
    return Number(
      parts.find((part) => part.type === type)
        ?.value ?? 0,
    );
  };

  const representedAsUtc = Date.UTC(
    getPart("year"),
    getPart("month") - 1,
    getPart("day"),
    getPart("hour"),
    getPart("minute"),
    getPart("second"),
  );

  return representedAsUtc - date.getTime();
}

function londonMidnightToUtc(
  year: number,
  month: number,
  day: number,
): Date {
  const targetAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0,
  );

  let result = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt++) {
    const offset = getTimeZoneOffsetMilliseconds(
      new Date(result),
    );

    result = targetAsUtc - offset;
  }

  return new Date(result);
}

export function londonDateKey(
  date: Date,
): Date {
  const parts = getLondonDateParts(date);

  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      0,
      0,
      0,
      0,
    ),
  );
}

export function startOfLondonDay(
  date: Date,
): Date {
  const parts = getLondonDateParts(date);

  return londonMidnightToUtc(
    parts.year,
    parts.month,
    parts.day,
  );
}

export function addLondonDays(
  date: Date,
  days: number,
): Date {
  const parts = getLondonDateParts(date);

  const target = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + days,
    ),
  );

  return londonMidnightToUtc(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
  );
}

export function startOfLondonWeek(
  date: Date,
): Date {
  const parts = getLondonDateParts(date);
  const daysSinceMonday =
    parts.weekday === 0 ? 6 : parts.weekday - 1;

  return addLondonDays(
    startOfLondonDay(date),
    -daysSinceMonday,
  );
}

export function startOfLondonMonth(
  date: Date,
): Date {
  const parts = getLondonDateParts(date);

  return londonMidnightToUtc(
    parts.year,
    parts.month,
    1,
  );
}

export function addLondonMonths(
  date: Date,
  months: number,
): Date {
  const parts = getLondonDateParts(date);

  const target = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1 + months,
      1,
    ),
  );

  return londonMidnightToUtc(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    1,
  );
}
