import { prisma } from "@/lib/prisma";

const SOURCE = "OPEN_METEO";
const LOCATION_KEY = "PLYMOUTH";
const LATITUDE = 50.3755;
const LONGITUDE = -4.1427;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type OpenMeteoResponse = {
  hourly?: {
    time?: number[];
    temperature_2m?: Array<number | null>;
    apparent_temperature?: Array<number | null>;
    precipitation?: Array<number | null>;
    rain?: Array<number | null>;
    snowfall?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
    cloud_cover?: Array<number | null>;
    visibility?: Array<number | null>;
    is_day?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
  error?: boolean;
  reason?: string;
};

function validateDate(value: string) {
  if (!DATE_PATTERN.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error(
      `Invalid weather date: ${value}`,
    );
  }
}

export async function syncHourlyWeather(
  from: string,
  to: string,
  allowBoundaryRetry = true,
) {
  validateDate(from);
  validateDate(to);
  if (from > to) throw new Error("Weather start_date exceeds end_date.");

  const url = new URL(
    "https://archive-api.open-meteo.com/v1/archive",
  );

  url.search = new URLSearchParams({
    latitude: String(LATITUDE),
    longitude: String(LONGITUDE),
    start_date: from,
    end_date: to,
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "snowfall",
      "wind_speed_10m",
      "wind_gusts_10m",
      "cloud_cover",
      "visibility",
      "is_day",
      "weather_code",
    ].join(","),
    timezone: "Europe/London",
    timeformat: "unixtime",
  }).toString();

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(60000),
  });

  const payload =
    (await response.json()) as OpenMeteoResponse;

  if (
    !response.ok ||
    payload.error ||
    !payload.hourly?.time
  ) {
    const maximum = archiveMaximumDate(payload.reason);
    if (allowBoundaryRetry && maximum && to > maximum) {
      if (from > maximum) return { source: SOURCE, locationKey: LOCATION_KEY, from, to: maximum, imported: 0, unavailable: true };
      return syncHourlyWeather(from, maximum, false);
    }
    throw new Error(
      payload.reason ??
        `Weather provider returned ${response.status}.`,
    );
  }

  const hourly = payload.hourly;
  const times = hourly.time ?? [];
  let imported = 0;

  for (let offset = 0; offset < times.length; offset += 100) {
    const batch = times.slice(offset, offset + 100);

    await prisma.$transaction(
      batch.map((unixTime, batchIndex) => {
        const index = offset + batchIndex;
        const observedAt = new Date(unixTime * 1000);

        const values = {
          latitude: LATITUDE,
          longitude: LONGITUDE,
          temperature:
            hourly.temperature_2m?.[index] ?? null,
          apparentTemperature:
            hourly.apparent_temperature?.[index] ??
            null,
          precipitation:
            hourly.precipitation?.[index] ?? null,
          rain: hourly.rain?.[index] ?? null,
          snowfall:
            hourly.snowfall?.[index] ?? null,
          windSpeed:
            hourly.wind_speed_10m?.[index] ??
            null,
          windGusts:
            hourly.wind_gusts_10m?.[index] ??
            null,
          cloudCover:
            hourly.cloud_cover?.[index] ?? null,
          visibility:
            hourly.visibility?.[index] ?? null,
          isDay:
            hourly.is_day?.[index] === null ||
            hourly.is_day?.[index] === undefined
              ? null
              : hourly.is_day[index] === 1,
          weatherCode:
            hourly.weather_code?.[index] ?? null,
        };

        return prisma.hourlyWeatherObservation.upsert({
          where: {
            source_locationKey_observedAt: {
              source: SOURCE,
              locationKey: LOCATION_KEY,
              observedAt,
            },
          },
          create: {
            source: SOURCE,
            locationKey: LOCATION_KEY,
            observedAt,
            ...values,
          },
          update: values,
        });
      }),
    );

    imported += batch.length;
  }

  return {
    source: SOURCE,
    locationKey: LOCATION_KEY,
    from,
    to,
    imported,
  };
}

export function archiveMaximumDate(reason?: string): string | null {
  const match = reason?.match(/end_date[^\n]*?from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/i);
  if (!match) return null;
  try { validateDate(match[2]); return match[2]; } catch { return null; }
}

const londonDateFormatter =
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

function londonDate(value: Date) {
  return londonDateFormatter.format(value);
}

export async function ensureHourlyWeatherCurrent(
  now = new Date(),
) {
  const today = londonDate(now);

  const latest =
    await prisma.hourlyWeatherObservation.findFirst({
      where: {
        source: SOURCE,
        locationKey: LOCATION_KEY,
      },
      orderBy: {
        observedAt: "desc",
      },
      select: {
        observedAt: true,
      },
    });

  const latestDate = latest
    ? londonDate(latest.observedAt)
    : null;

  if (latestDate === today) {
    return {
      updated: false,
      through: today,
    };
  }

  const from = latestDate ?? today;
  const result = await syncHourlyWeather(
    from,
    today,
  );

  return {
    updated: result.imported > 0,
    through: result.to,
    imported: result.imported,
  };
}
