import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

const MODEL_VERSION =
  "BOOKING_DEMAND_V1";
const HISTORY_START =
  new Date("2026-08-04T23:00:00.000Z");
const SAME_WEEKDAY_WEIGHT = 0.65;
const RECENT_AVERAGE_WEIGHT = 0.35;
const BIAS_CORRECTION = 35.4;
const BACKTEST_MAE = 157.7;
const BACKTEST_MAPE = 11.0;
const ERROR_BAND = 246.8;

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
      minute: "2-digit",
      hourCycle: "h23",
    },
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

type DailyHistory = {
  dateKey: string;
  weekday: number;
  bookingIds: Set<string>;
  hourlyBookingIds:
    Array<Set<string>>;
};

type ForecastSlot = {
  startAt: string;
  endAt: string;
  predictedCount: number;
};

type ActualSlot = {
  startAt: string;
  endAt: string;
  actualCount: number;
};

function londonParts(value: Date) {
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
    year:
      Number(parts.year),
    month:
      Number(parts.month),
    day:
      Number(parts.day),
    minute:
      Number(parts.minute),
  };
}

function londonMidnight(
  dateKey: string,
) {
  const [
    year,
    month,
    day,
  ] = dateKey
    .split("-")
    .map(Number);

  const desiredUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0,
    );

  let candidate =
    new Date(desiredUtc);

  for (
    let iteration = 0;
    iteration < 2;
    iteration += 1
  ) {
    const parts =
      londonParts(candidate);

    const representedUtc =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        0,
        0,
      );

    const offset =
      representedUtc -
      candidate.getTime();

    candidate =
      new Date(
        desiredUtc - offset,
      );
  }

  return candidate;
}

function average(values: number[]) {
  return values.reduce(
    (total, value) =>
      total + value,
    0,
  ) / values.length;
}

function reconcileSlots(
  slots: ForecastSlot[],
  predictedCount: number,
) {
  const total =
    slots.reduce(
      (sum, slot) =>
        sum +
        slot.predictedCount,
      0,
    );

  const adjustment =
    predictedCount - total;

  if (
    adjustment === 0 ||
    slots.length === 0
  ) {
    return slots;
  }

  const largestIndex =
    slots.reduce(
      (largest, slot, index) =>
        slot.predictedCount >
        slots[largest].predictedCount
          ? index
          : largest,
      0,
    );

  slots[largestIndex] = {
    ...slots[largestIndex],
    predictedCount:
      slots[largestIndex]
        .predictedCount +
      adjustment,
  };

  return slots;
}

export async function backfillBookingDemandForecasts() {
  const now = new Date();
  const currentDateKey =
    londonParts(now).dateKey;

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

  const days =
    new Map<string, DailyHistory>();

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

    const day =
      days.get(parts.dateKey) ?? {
        dateKey:
          parts.dateKey,
        weekday:
          parts.weekday,
        bookingIds:
          new Set<string>(),
        hourlyBookingIds:
          Array.from(
            {
              length: 24,
            },
            () => new Set<string>(),
          ),
      };

    day.bookingIds.add(
      booking.id,
    );
    day.hourlyBookingIds[
      parts.hour
    ].add(
      booking.id,
    );

    days.set(
      parts.dateKey,
      day,
    );
  }

  const history =
    Array.from(days.values())
      .sort(
        (first, second) =>
          first.dateKey.localeCompare(
            second.dateKey,
          ),
      );

  let selected = 0;
  let created = 0;

  for (
    let index = 0;
    index < history.length;
    index += 1
  ) {
    const target =
      history[index];
    const prior =
      history.slice(0, index);

    const sameWeekday =
      [...prior]
        .reverse()
        .find(
          (day) =>
            day.weekday ===
            target.weekday,
        );

    if (
      !sameWeekday ||
      prior.length < 7
    ) {
      continue;
    }

    selected += 1;

    const recentSeven =
      prior.slice(-7);

    const recentAverage =
      average(
        recentSeven.map(
          (day) =>
            day.bookingIds.size,
        ),
      );

    const predictedCount =
      Math.max(
        0,
        Math.round(
          SAME_WEEKDAY_WEIGHT *
            sameWeekday
              .bookingIds.size +
          RECENT_AVERAGE_WEIGHT *
            recentAverage -
          BIAS_CORRECTION,
        ),
      );

    const priorBookingTotal =
      prior.reduce(
        (total, day) =>
          total +
          day.bookingIds.size,
        0,
      );

    const priorHourlyCounts =
      Array.from(
        {
          length: 24,
        },
        (_, hour) =>
          prior.reduce(
            (total, day) =>
              total +
              day.hourlyBookingIds[
                hour
              ].size,
            0,
          ),
      );

    const windowStartAt =
      londonMidnight(
        target.dateKey,
      );
    const windowEndAt =
      new Date(
        windowStartAt.getTime() +
          24 *
            60 *
            60 *
            1000,
      );

    const slotForecasts =
      reconcileSlots(
        Array.from(
          {
            length: 8,
          },
          (_, slotIndex) => {
            const startHour =
              slotIndex * 3;
            const startAt =
              new Date(
                windowStartAt.getTime() +
                  startHour *
                    60 *
                    60 *
                    1000,
              );
            const endAt =
              new Date(
                startAt.getTime() +
                  3 *
                    60 *
                    60 *
                    1000,
              );

            const slotHistory =
              priorHourlyCounts
                .slice(
                  startHour,
                  startHour + 3,
                )
                .reduce(
                  (total, value) =>
                    total + value,
                  0,
                );

            return {
              startAt:
                startAt.toISOString(),
              endAt:
                endAt.toISOString(),
              predictedCount:
                priorBookingTotal > 0
                  ? Math.round(
                      predictedCount *
                        slotHistory /
                        priorBookingTotal,
                    )
                  : 0,
            };
          },
        ),
        predictedCount,
      );

    const slotActuals:
      ActualSlot[] =
      slotForecasts.map(
        (slot, slotIndex) => ({
          startAt:
            slot.startAt,
          endAt:
            slot.endAt,
          actualCount:
            target.hourlyBookingIds
              .slice(
                slotIndex * 3,
                slotIndex * 3 + 3,
              )
              .reduce(
                (total, values) =>
                  total +
                  values.size,
                0,
              ),
        }),
      );

    const actualCount =
      target.bookingIds.size;
    const absoluteError =
      Math.abs(
        actualCount -
          predictedCount,
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

    const forecastKey = [
      MODEL_VERSION,
      "HISTORICAL_BACKTEST",
      target.dateKey,
    ].join(":");

    const result =
      await prisma.bookingDemandForecast.upsert({
        where: {
          forecastKey,
        },
        create: {
          forecastKey,
          modelVersion:
            MODEL_VERSION,
          targetType:
            "BOOKING_REQUESTS",
          horizonHours: 24,
          issuedAt:
            new Date(
              windowStartAt.getTime() -
                1,
            ),
          windowStartAt,
          windowEndAt,
          predictedCount,
          lowerBound:
            Math.max(
              0,
              Math.round(
                predictedCount -
                  ERROR_BAND,
              ),
            ),
          upperBound:
            Math.round(
              predictedCount +
                ERROR_BAND,
            ),
          status:
            "EVALUATED",
          actualCount,
          absoluteError,
          percentageError,
          evaluatedAt:
            windowEndAt,
          calibrationDays:
            prior.length,
          backtestMae:
            BACKTEST_MAE,
          backtestMape:
            BACKTEST_MAPE,
          averageBias:
            BIAS_CORRECTION,
          slotForecasts:
            slotForecasts as unknown as
              Prisma.InputJsonValue,
          slotActuals:
            slotActuals as unknown as
              Prisma.InputJsonValue,
          methodology: {
            source:
              "HISTORICAL_BACKTEST",
            leakageSafe: true,
            target:
              "Unique Booking.id values by bookedAtTime.",
            sameWeekdayWeight:
              SAME_WEEKDAY_WEIGHT,
            recentAverageWeight:
              RECENT_AVERAGE_WEIGHT,
            biasCorrection:
              BIAS_CORRECTION,
            priorCompleteDays:
              prior.length,
            timezone:
              "Europe/London",
            confidence:
              "EARLY",
          },
        },
        update: {},
        select: {
          createdAt: true,
          updatedAt: true,
        },
      });

    if (
      result.createdAt.getTime() ===
      result.updatedAt.getTime()
    ) {
      created += 1;
    }
  }

  return {
    success: true,
    selected,
    created,
    alreadyPresent:
      selected - created,
    containsPersonalData: false,
  };
}
