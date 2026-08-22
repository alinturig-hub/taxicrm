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
    weather_code?: Array<number | null>;
  };
  error?: boolean;
  reason?: string;
};

function validateDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(
      `Invalid weather date: ${value}`,
    );
  }
}

export async function syncHourlyWeather(
  from: string,
  to: string,
) {
  validateDate(from);
  validateDate(to);

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
      "weather_code",
    ].join(","),
    timezone: "Europe/London",
    timeformat: "unixtime",
  }).toString();

  const response = await fetch(url, {
    cache: "no-store",
  });

  const payload =
    (await response.json()) as OpenMeteoResponse;

  if (
    !response.ok ||
    payload.error ||
    !payload.hourly?.time
  ) {
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
    updated: true,
    through: today,
    imported: result.imported,
  };
}
