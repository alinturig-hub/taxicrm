import { refreshCustomerBookingPrediction } from "./customer-booking-predictions";
import { Prisma } from "@/generated/prisma/client";

import { buildCustomerBehaviourChange } from "@/lib/customers/customer-behaviour-change";
import { buildNextBookingPrediction } from "@/lib/customers/customer-next-booking";
import { buildCustomerNeedPropensity } from "@/lib/customers/customer-need-propensity";
import { buildCustomerProfileDataQuality } from "@/lib/customers/customer-profile-data-quality";
import { buildCustomerProfile } from "@/lib/customers/customer-profiler";
import {
  londonSnapshotDate,
  saveCustomerProfileSnapshot,
} from "@/lib/customers/customer-profile-snapshots";
import { buildCustomerRelationshipQuality } from "@/lib/customers/customer-relationship-quality";
import { buildCustomerReturnJourney } from "@/lib/customers/customer-return-journey";
import { buildCustomerRhythm } from "@/lib/customers/customer-rhythm";
import { buildCustomerServiceOutcomes } from "@/lib/customers/customer-service-outcomes";
import { buildWeatherCoverageIndex, countWeatherMatchedBookings } from "@/lib/customers/customer-weather-intelligence";
import { prisma } from "@/lib/prisma";
import { ensureHourlyWeatherCurrent } from "@/lib/weather/sync-hourly-weather";

type BatchOptions = {
  limit?: number;
  activeDays?: number;
  minimumBookings?: number;
  now?: Date;
  scope?: "eligible" | "all";
  afterId?: string;
  throughId?: string;
  skipExternal?: boolean;
  refreshPredictions?: boolean;
};

type EligibleCustomer = {
  id: string;
};

export async function generateDailyProfileSnapshots({
  limit = 50,
  activeDays = 60,
  minimumBookings = 5,
  now = new Date(),
  scope = "eligible", afterId, throughId, skipExternal = false, refreshPredictions = false,
}: BatchOptions = {}) {
  const safeLimit = Math.min(
    Math.max(Math.trunc(limit), 1),
    scope === "all" ? 100 : 50,
  );

  const safeActiveDays = Math.min(
    Math.max(Math.trunc(activeDays), 1),
    365,
  );

  const safeMinimumBookings = Math.min(
    Math.max(Math.trunc(minimumBookings), 1),
    100,
  );

  const snapshotDate =
    londonSnapshotDate(now);

  const snapshotDateIso =
    snapshotDate.toISOString().slice(0, 10);

  const snapshotDateDisplay = [
    snapshotDateIso.slice(8, 10),
    snapshotDateIso.slice(5, 7),
    snapshotDateIso.slice(0, 4),
  ].join("/");

  const activeSince = new Date(
    now.getTime() -
      safeActiveDays * 24 * 60 * 60 * 1000,
  );

  const selectedCustomers = scope === "all" ? await prisma.normalCustomer.findMany({ where: { id: { ...(afterId ? { gt: afterId } : {}), ...(throughId ? { lte: throughId } : {}) } }, orderBy: { id: "asc" }, take: safeLimit + 1, select: { id: true } }) :
    await prisma.$queryRaw<
      EligibleCustomer[]
    >(Prisma.sql`
      SELECT customer.id
      FROM "NormalCustomer" customer
      WHERE
        customer."lastBookingAt" >= ${activeSince}
        AND (
          SELECT COUNT(*)
          FROM "Booking" booking
          WHERE booking."normalCustomerId" =
            customer.id
        ) >= ${safeMinimumBookings}
        AND NOT EXISTS (
          SELECT 1
          FROM "CustomerProfileSnapshot" snapshot
          WHERE
            snapshot."normalCustomerId" =
              customer.id
            AND snapshot."snapshotDate" =
              ${snapshotDate}
        )
      ORDER BY
        customer."lastBookingAt" DESC,
        customer.id ASC
      LIMIT ${safeLimit}
    `);

  const eligibleCustomers = selectedCustomers.slice(0, safeLimit);
  const moreCustomers = scope === "all" ? selectedCustomers.length > safeLimit : eligibleCustomers.length === safeLimit;

  if (eligibleCustomers.length === 0) {
    return {
      success: true,
      snapshotDate:
        snapshotDateDisplay,
      snapshotDateIso,
      selected: 0,
      saved: 0,
      failed: 0,
      hasMore: false,
      nextCursor: null,
    };
  }

  try {
    if (!skipExternal) await ensureHourlyWeatherCurrent(now);
  } catch (error) {
    console.error(
      "Daily snapshot weather refresh failed:",
      error,
    );
  }

  const weatherObservations =
    await prisma.hourlyWeatherObservation.findMany({
      where: {
        locationKey: "PLYMOUTH",
      },
      orderBy: {
        observedAt: "asc",
      },
      select: {
        observedAt: true,

      },
    });

  const weatherHours = buildWeatherCoverageIndex(weatherObservations);

  const customerSelect = {
        id: true,
        bookings: {
          orderBy: [
            {
              pickupDueTime: "desc",
            },
            {
              bookedAtTime: "desc",
            },
          ],
          select: {
            externalId: true,
            status: true,
            bookedAtTime: true,
            pickupDueTime: true,
            completedAt: true,
            price: true,
              cost: true,
            distance: true,
            paymentType: true,
            bookingSource: true,
            passengers: true,
            luggage: true,
            capabilities: true,
            locations: {
              select: {
                type: true,
                address: true,
                zoneName: true,
                placeIntelligence: {
                  select: {
                    id: true,
                    placeName: true,
                    formattedAddress: true,
                    category: true,
                    website: true,
                    confidence: true,
                    isSensitive: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      } satisfies Prisma.NormalCustomerSelect;

  let saved = 0;
  let failed = 0;
  const failedCustomerIds: string[] = [];

  for (const eligible of eligibleCustomers) {
    try {
      const customer = await prisma.normalCustomer.findUniqueOrThrow({ where: { id: eligible.id }, select: customerSelect });
      const profile =
        buildCustomerProfile(
          customer.bookings, now,
        );

      const nextBookingPrediction =
        buildNextBookingPrediction(
          customer.bookings,
        );

      const customerRhythm =
        buildCustomerRhythm(
          customer.bookings,
        );

      const relationshipQuality =
        buildCustomerRelationshipQuality(
          customer.bookings,
          customerRhythm,
        );

      const serviceOutcomes =
        buildCustomerServiceOutcomes(
          customer.bookings,
        );

      const behaviourChange =
        buildCustomerBehaviourChange(
          customer.bookings,
        );

      const returnJourney =
        buildCustomerReturnJourney(
          customer.bookings,
        );

      const needPropensity =
        buildCustomerNeedPropensity({
          profileSafeForPersonalisation:
            profile.classification
              .profileSafeForPersonalisation,
          prediction:
            nextBookingPrediction,
          rhythm: customerRhythm,
          returnJourney,
        });

      const weatherMatchedBookings = countWeatherMatchedBookings(customer.bookings, weatherHours);

      const profileDataQuality =
        buildCustomerProfileDataQuality(
          customer.bookings,
          {
            weatherMatchedBookings,
          },
        );

      await saveCustomerProfileSnapshot(
        {
          customerId: customer.id,
          profile,
          needPropensity,
          relationshipQuality,
          customerRhythm,
          returnJourney,
          serviceOutcomes,
          profileDataQuality,
          behaviourChange,
        },
        now,
      );

      if (refreshPredictions) await refreshCustomerBookingPrediction(customer.id, { now });
      saved += 1;
    } catch (error) {
      failed += 1;
      failedCustomerIds.push(eligible.id);

      console.error(
        "Daily customer snapshot failed.",
        error,
      );
    }
  }

  return {
    success: failed === 0,
    snapshotDate:
      snapshotDateDisplay,
    snapshotDateIso,
    selected: eligibleCustomers.length,
    saved,
    failed,
    hasMore: moreCustomers,
    nextCursor: eligibleCustomers.at(-1)?.id ?? null,
    failedCustomerIds,
  };
}
