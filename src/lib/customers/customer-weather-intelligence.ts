type WeatherBooking = {
  pickupDueTime: Date | null;
  bookedAtTime: Date | null;
};

type WeatherObservation = {
  observedAt: Date;
  temperature: unknown;
  apparentTemperature: unknown;
  precipitation: unknown;
  rain: unknown;
  snowfall: unknown;
  windSpeed: unknown;
  windGusts: unknown;
  cloudCover: number | null;
  isDay: boolean | null;
  weatherCode: number | null;
};

function numberValue(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function hourKey(date: Date) {
  const rounded = new Date(date);
  rounded.setUTCMinutes(0, 0, 0);

  return rounded.getTime();
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

export function buildCustomerWeatherIntelligence(
  bookings: WeatherBooking[],
  observations: WeatherObservation[],
) {
  const weatherByHour = new Map(
    observations.map((observation) => {
      const temperature = optionalNumber(
        observation.temperature,
      );
      const apparentTemperature =
        optionalNumber(
          observation.apparentTemperature,
        );
      const weatherCode =
        observation.weatherCode ?? 0;

      return [
        hourKey(observation.observedAt),
        {
          rainy:
            numberValue(observation.rain) >
              0.1 ||
            numberValue(
              observation.precipitation,
            ) > 0.1,
          snowy:
            numberValue(
              observation.snowfall,
            ) > 0,
          foggy:
            weatherCode === 45 ||
            weatherCode === 48,
          strongWind:
            numberValue(
              observation.windGusts,
            ) >= 40,
          night:
            observation.isDay === false,
          cold:
            (
              apparentTemperature ??
              temperature ??
              100
            ) <= 5,
          temperature,
          apparentTemperature,
        },
      ] as const;
    }),
  );

  const rainyHours = observations.filter(
    (observation) =>
      numberValue(observation.rain) > 0.1 ||
      numberValue(observation.precipitation) >
        0.1,
  ).length;

  const dryHours =
    observations.length - rainyHours;

  let matchedBookings = 0;
  let rainyBookings = 0;
  let dryBookings = 0;
  let snowyBookings = 0;
  let foggyBookings = 0;
  let strongWindBookings = 0;
  let nightBookings = 0;
  let coldBookings = 0;
  let temperatureTotal = 0;
  let temperatureMatches = 0;
  let apparentTemperatureTotal = 0;
  let apparentTemperatureMatches = 0;

  for (const booking of bookings) {
    const bookingAt =
      booking.pickupDueTime ??
      booking.bookedAtTime;

    if (!bookingAt) {
      continue;
    }

    const weather = weatherByHour.get(
      hourKey(bookingAt),
    );

    if (!weather) {
      continue;
    }

    matchedBookings += 1;

    if (weather.rainy) {
      rainyBookings += 1;
    } else {
      dryBookings += 1;
    }

    if (weather.snowy) {
      snowyBookings += 1;
    }

    if (weather.foggy) {
      foggyBookings += 1;
    }

    if (weather.strongWind) {
      strongWindBookings += 1;
    }

    if (weather.night) {
      nightBookings += 1;
    }

    if (weather.cold) {
      coldBookings += 1;
    }

    if (weather.temperature !== null) {
      temperatureTotal += weather.temperature;
      temperatureMatches += 1;
    }

    if (
      weather.apparentTemperature !== null
    ) {
      apparentTemperatureTotal +=
        weather.apparentTemperature;
      apparentTemperatureMatches += 1;
    }
  }

  const rainyRate =
    rainyHours > 0
      ? (rainyBookings / rainyHours) * 100
      : 0;

  const dryRate =
    dryHours > 0
      ? (dryBookings / dryHours) * 100
      : 0;

  const liftPercent =
    dryRate > 0
      ? ((rainyRate - dryRate) / dryRate) *
        100
      : null;

  const enoughData =
    matchedBookings >= 5 &&
    rainyHours >= 12 &&
    rainyBookings >= 2;

  const confidence = enoughData
    ? Math.min(
        90,
        Math.round(
          35 +
            Math.min(matchedBookings, 40) *
              1.25,
        ),
      )
    : Math.min(45, matchedBookings * 5);

  let tendency:
    | "MORE_LIKELY_IN_RAIN"
    | "LESS_LIKELY_IN_RAIN"
    | "NO_CLEAR_DIFFERENCE"
    | "INSUFFICIENT_DATA";

  if (!enoughData || liftPercent === null) {
    tendency = "INSUFFICIENT_DATA";
  } else if (liftPercent >= 20) {
    tendency = "MORE_LIKELY_IN_RAIN";
  } else if (liftPercent <= -20) {
    tendency = "LESS_LIKELY_IN_RAIN";
  } else {
    tendency = "NO_CLEAR_DIFFERENCE";
  }

  const message =
    tendency === "MORE_LIKELY_IN_RAIN"
      ? `This customer books ${round(Math.abs(liftPercent ?? 0))}% more often during rainy hours.`
      : tendency === "LESS_LIKELY_IN_RAIN"
        ? `This customer books ${round(Math.abs(liftPercent ?? 0))}% less often during rainy hours.`
        : tendency === "NO_CLEAR_DIFFERENCE"
          ? "No meaningful difference between rainy and dry booking behaviour was detected."
          : `Not enough matched rainy journeys yet (${rainyBookings} rainy of ${matchedBookings} weather-matched bookings).`;

  return {
    weatherAvailable:
      observations.length > 0,
    enoughData,
    matchedBookings,
    rainyBookings,
    dryBookings,
    snowyBookings,
    foggyBookings,
    strongWindBookings,
    nightBookings,
    coldBookings,
    averageTemperature:
      temperatureMatches > 0
        ? round(
            temperatureTotal /
              temperatureMatches,
          )
        : null,
    averageApparentTemperature:
      apparentTemperatureMatches > 0
        ? round(
            apparentTemperatureTotal /
              apparentTemperatureMatches,
          )
        : null,
    rainyBookingPercentage:
      matchedBookings > 0
        ? round(
            (rainyBookings /
              matchedBookings) *
              100,
          )
        : 0,
    rainyHours,
    dryHours,
    rainyBookingsPer100Hours:
      round(rainyRate, 2),
    dryBookingsPer100Hours:
      round(dryRate, 2),
    liftPercent:
      liftPercent === null
        ? null
        : round(liftPercent),
    tendency,
    confidence,
    weatherMessage: message,
  };
}
