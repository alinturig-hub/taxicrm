import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

const MODEL_VERSION =
  "BOOKING_DEMAND_V1";
const TARGET_TYPE =
  "BOOKING_REQUESTS";
const HORIZON_HOURS = 24;
const SLOT_HOURS = 3;
const HISTORY_START =
  new Date("2026-08-04T23:00:00.000Z");

const SAME_WEEKDAY_WEIGHT = 0.65;
const RECENT_AVERAGE_WEIGHT = 0.35;
const BACKTEST_MAE = 157.7;
const BACKTEST_MAPE = 11.0;
const AVERAGE_BIAS = 35.4;
const EIGHTY_PERCENT_ERROR = 246.8;
const MINIMUM_COMPLETE_DAYS = 8;

const londonFormatter =
  new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    },
  );

type LondonParts = {
  dateKey: string;
  weekday: number;
  hour: number;
};

type SlotForecast = {
  startAt: string;
  endAt: string;
  predictedCount: number;
};

type SlotActual = {
  startAt: string;
  endAt: string;
  actualCount: number;
};

function londonParts(
  value: Date,
): LondonParts {
  const parts = Object.fromEntries(
    londonFormatter
      .formatToParts(value)
      .filter(
        (part) =>
          part.type !== "literal",
      )
      .map(
        (part) => [
          part.type,
          part.value,
        ],
      ),
  );

  const weekdayMap:
    Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };

  return {
    dateKey: [
      parts.year,
      parts.month,
      parts.day,
    ].join("-"),
    weekday:
      weekdayMap[parts.weekday] ?? 1,
    hour:
      Number(parts.hour),
  };
}

function average(values: number[]) {
  return values.length > 0
    ? values.reduce(
        (total, value) =>
          total + value,
        0,
      ) / values.length
    : 0;
}

function cycleStart(value: Date) {
  const milliseconds =
    SLOT_HOURS * 60 * 60 * 1000;

  return new Date(
    Math.floor(
      value.getTime() /
      milliseconds,
    ) * milliseconds,
  );
}

async function buildForecastInput(
  now: Date,
) {
  const bookings =
    await prisma.booking.findMany({
      where: {
        bookedAtTime: {
          gte: HISTORY_START,
          lt: now,
        },
      },
      select: {
        id: true,
        bookedAtTime: true,
      },
    });

  const currentDateKey =
    londonParts(now).dateKey;

  const dailyBookings =
    new Map<
      string,
      {
        weekday: number;
        bookingIds: Set<string>;
      }
    >();

  const hourlyCounts =
    Array.from(
      {
        length: 24,
      },
      () => 0,
    );

  let completeHistoryBookings = 0;

  for (const booking of bookings) {
    if (!booking.bookedAtTime) {
      continue;
    }

    const parts =
      londonParts(
        booking.bookedAtTime,
      );

    if (
      parts.dateKey ===
      currentDateKey
    ) {
      continue;
    }

    const daily =
      dailyBookings.get(
        parts.dateKey,
      ) ?? {
        weekday:
          parts.weekday,
        bookingIds:
          new Set<string>(),
      };

    if (
      !daily.bookingIds.has(
        booking.id,
      )
    ) {
      daily.bookingIds.add(
        booking.id,
      );

      hourlyCounts[parts.hour] += 1;
      completeHistoryBookings += 1;
    }

    dailyBookings.set(
      parts.dateKey,
      daily,
    );
  }

  const dailyHistory =
    Array.from(
      dailyBookings.entries(),
    )
      .map(
        ([
          dateKey,
          value,
        ]) => ({
          dateKey,
          weekday:
            value.weekday,
          count:
            value.bookingIds.size,
        }),
      )
      .sort(
        (first, second) =>
          first.dateKey.localeCompare(
            second.dateKey,
          ),
      );

  if (
    dailyHistory.length <
    MINIMUM_COMPLETE_DAYS
  ) {
    throw new Error(
      "Not enough complete booking history for a demand forecast.",
    );
  }

  const recentSeven =
    dailyHistory.slice(-7);

  const recentAverage =
    average(
      recentSeven.map(
        (day) => day.count,
      ),
    );

  const hourlyShares =
    hourlyCounts.map(
      (count) =>
        completeHistoryBookings > 0
          ? count /
            completeHistoryBookings
          : 0,
    );

  return {
    dailyHistory,
    recentAverage,
    hourlyShares,
  };
}

function weekdayForecast(
  weekday: number,
  input: Awaited<
    ReturnType<
      typeof buildForecastInput
    >
  >,
) {
  const sameWeekday =
    [...input.dailyHistory]
      .reverse()
      .find(
        (day) =>
          day.weekday === weekday,
      );

  if (!sameWeekday) {
    return input.recentAverage;
  }

  return (
    SAME_WEEKDAY_WEIGHT *
      sameWeekday.count +
    RECENT_AVERAGE_WEIGHT *
      input.recentAverage
  );
}

export async function createBookingDemandForecast({
  now = new Date(),
}: {
  now?: Date;
} = {}) {
  const cycle =
    cycleStart(now);

  const forecastKey = [
    MODEL_VERSION,
    TARGET_TYPE,
    HORIZON_HOURS,
    cycle.toISOString(),
  ].join(":");

  const existing =
    await prisma.bookingDemandForecast.findUnique({
      where: {
        forecastKey,
      },
    });

  if (existing) {
    return {
      created: false,
      forecast: existing,
    };
  }

  const input =
    await buildForecastInput(now);

  const windowStartAt =
    new Date(now);
  const windowEndAt =
    new Date(
      now.getTime() +
        HORIZON_HOURS *
          60 *
          60 *
          1000,
    );

  const hourlyForecasts =
    Array.from(
      {
        length: HORIZON_HOURS,
      },
      (_, index) => {
        const midpoint =
          new Date(
            windowStartAt.getTime() +
              (
                index + 0.5
              ) *
                60 *
                60 *
                1000,
          );

        const parts =
          londonParts(midpoint);

        return (
          weekdayForecast(
            parts.weekday,
            input,
          ) *
          input.hourlyShares[
            parts.hour
          ]
        );
      },
    );

  const rawPredictedCount =
    hourlyForecasts.reduce(
      (total, value) =>
        total + value,
      0,
    );

  const predictedCount =
    Math.max(
      0,
      Math.round(
        rawPredictedCount -
          AVERAGE_BIAS,
      ),
    );

  const slots: SlotForecast[] =
    Array.from(
      {
        length:
          HORIZON_HOURS /
          SLOT_HOURS,
      },
      (_, slotIndex) => {
        const firstHour =
          slotIndex * SLOT_HOURS;

        const startAt =
          new Date(
            windowStartAt.getTime() +
              firstHour *
                60 *
                60 *
                1000,
          );

        const endAt =
          new Date(
            startAt.getTime() +
              SLOT_HOURS *
                60 *
                60 *
                1000,
          );

        const rawSlotCount =
          hourlyForecasts
            .slice(
              firstHour,
              firstHour +
                SLOT_HOURS,
            )
            .reduce(
              (total, value) =>
                total + value,
              0,
            );

        const share =
          rawPredictedCount > 0
            ? rawSlotCount /
              rawPredictedCount
            : 0;

        return {
          startAt:
            startAt.toISOString(),
          endAt:
            endAt.toISOString(),
          predictedCount:
            Math.max(
              0,
              Math.round(
                predictedCount *
                  share,
              ),
            ),
        };
      },
    );

  const slotTotal =
    slots.reduce(
      (total, slot) =>
        total +
        slot.predictedCount,
      0,
    );

  const slotAdjustment =
    predictedCount -
    slotTotal;

  if (
    slotAdjustment !== 0 &&
    slots.length > 0
  ) {
    const largestSlot =
      slots.reduce(
        (largest, slot, index) =>
          slot.predictedCount >
          slots[largest].predictedCount
            ? index
            : largest,
        0,
      );

    slots[largestSlot] = {
      ...slots[largestSlot],
      predictedCount:
        slots[largestSlot]
          .predictedCount +
        slotAdjustment,
    };
  }

  const forecast =
    await prisma.bookingDemandForecast.create({
      data: {
        forecastKey,
        modelVersion:
          MODEL_VERSION,
        targetType:
          TARGET_TYPE,
        horizonHours:
          HORIZON_HOURS,
        issuedAt: now,
        windowStartAt,
        windowEndAt,
        predictedCount,
        lowerBound:
          Math.max(
            0,
            Math.round(
              predictedCount -
                EIGHTY_PERCENT_ERROR,
            ),
          ),
        upperBound:
          Math.round(
            predictedCount +
              EIGHTY_PERCENT_ERROR,
          ),
        calibrationDays:
          input.dailyHistory.length,
        backtestMae:
          BACKTEST_MAE,
        backtestMape:
          BACKTEST_MAPE,
        averageBias:
          AVERAGE_BIAS,
        slotForecasts:
          slots as unknown as
            Prisma.InputJsonValue,
        methodology: {
          target:
            "Unique Booking.id values by bookedAtTime.",
          sameWeekdayWeight:
            SAME_WEEKDAY_WEIGHT,
          recentAverageWeight:
            RECENT_AVERAGE_WEIGHT,
          recentDays: 7,
          historyStart:
            HISTORY_START
              .toISOString(),
          timezone:
            "Europe/London",
          confidence:
            "EARLY",
        },
      },
    });

  return {
    created: true,
    forecast,
  };
}

export async function evaluateExpiredDemandForecasts({
  now = new Date(),
  limit = 50,
}: {
  now?: Date;
  limit?: number;
} = {}) {
  const safeLimit = Math.min(
    Math.max(
      Math.trunc(limit),
      1,
    ),
    200,
  );

  const expired =
    await prisma.bookingDemandForecast.findMany({
      where: {
        status: "PENDING",
        windowEndAt: {
          lte: now,
        },
      },
      orderBy: {
        windowEndAt: "asc",
      },
      take: safeLimit,
    });

  let evaluated = 0;

  for (const forecast of expired) {
    const bookings =
      await prisma.booking.findMany({
        where: {
          bookedAtTime: {
            gte:
              forecast.windowStartAt,
            lt:
              forecast.windowEndAt,
          },
        },
        select: {
          id: true,
          bookedAtTime: true,
        },
      });

    const uniqueBookings =
      new Map(
        bookings.map(
          (booking) => [
            booking.id,
            booking,
          ],
        ),
      );

    const slots =
      forecast.slotForecasts as
        unknown as SlotForecast[];

    const slotActuals:
      SlotActual[] =
      slots.map((slot) => {
        const startAt =
          new Date(slot.startAt);
        const endAt =
          new Date(slot.endAt);

        const actualCount =
          Array.from(
            uniqueBookings.values(),
          ).filter(
            (booking) =>
              booking.bookedAtTime !==
                null &&
              booking.bookedAtTime >=
                startAt &&
              booking.bookedAtTime <
                endAt,
          ).length;

        return {
          startAt:
            slot.startAt,
          endAt:
            slot.endAt,
          actualCount,
        };
      });

    const actualCount =
      uniqueBookings.size;

    const absoluteError =
      Math.abs(
        actualCount -
          forecast.predictedCount,
      );

    const percentageError =
      actualCount > 0
        ? Number(
            (
              100 *
              absoluteError /
              actualCount
            ).toFixed(2),
          )
        : null;

    const updated =
      await prisma.bookingDemandForecast.updateMany({
        where: {
          id: forecast.id,
          status: "PENDING",
        },
        data: {
          status: "EVALUATED",
          actualCount,
          absoluteError,
          percentageError,
          evaluatedAt: now,
          slotActuals:
            slotActuals as unknown as
              Prisma.InputJsonValue,
        },
      });

    evaluated += updated.count;
  }

  return {
    selected: expired.length,
    evaluated,
    hasMore:
      expired.length === safeLimit,
  };
}

export async function maintainBookingDemandForecast({
  now = new Date(),
}: {
  now?: Date;
} = {}) {
  const evaluation =
    await evaluateExpiredDemandForecasts({
      now,
    });

  const current =
    await createBookingDemandForecast({
      now,
    });

  return {
    success: true,
    evaluation,
    created:
      current.created,
    forecast:
      current.forecast,
    containsPersonalData: false,
  };
}
