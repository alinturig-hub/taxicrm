import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { buildCustomerProfile } from "@/lib/customers/customer-profiler";
import { buildCustomerProfileDataQuality } from "@/lib/customers/customer-profile-data-quality";
import {
  getCustomerProfileHistory,
  saveCustomerProfileSnapshot,
} from "@/lib/customers/customer-profile-snapshots";
import { buildNextBookingPrediction } from "@/lib/customers/customer-next-booking";
import { buildCustomerNeedPropensity } from "@/lib/customers/customer-need-propensity";
import { buildCustomerRhythm } from "@/lib/customers/customer-rhythm";
import { buildCustomerOperationalPreferences } from "@/lib/customers/customer-operational-preferences";
import { buildCustomerRelationshipQuality } from "@/lib/customers/customer-relationship-quality";
import { buildCustomerReturnJourney } from "@/lib/customers/customer-return-journey";
import { buildCustomerServiceOutcomes } from "@/lib/customers/customer-service-outcomes";
import { buildCustomerBehaviourChange } from "@/lib/customers/customer-behaviour-change";
import { buildCustomerBookingWindow } from "@/lib/customers/customer-booking-window";
import { buildCustomerWeatherIntelligence } from "@/lib/customers/customer-weather-intelligence";
import { buildCustomerContextualIntelligence } from "@/lib/customers/customer-contextual-intelligence";
import { prisma } from "@/lib/prisma";
import { ensureHourlyWeatherCurrent } from "@/lib/weather/sync-hourly-weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: {
    params: {
      id: string;
    };
  },
) {
  const session =
    await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      {
        success: false,
        error: "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const customer =
      await prisma.normalCustomer.findUnique({
        where: {
          id: context.params.id,
        },
        select: {
          id: true,
          displayName: true,
          telephoneNumber: true,
          email: true,
          firstBookingAt: true,
          lastBookingAt: true,
          createdAt: true,
          updatedAt: true,
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
        },
      });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          error: "CUSTOMER_NOT_FOUND",
          message: "Customer could not be found.",
        },
        {
          status: 404,
        },
      );
    }

    const profile =
      buildCustomerProfile(customer.bookings);

    const nextBookingPrediction =
      buildNextBookingPrediction(
        customer.bookings,
      );

    const bookingWindow =
      buildCustomerBookingWindow(
        customer.bookings,
        {
          profileSafeForPersonalisation:
            profile.classification
              .profileSafeForPersonalisation,
        },
      );

    const customerRhythm =
      buildCustomerRhythm(
        customer.bookings,
      );

    const operationalPreferences =
      buildCustomerOperationalPreferences(
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

    try {
      await ensureHourlyWeatherCurrent();
    } catch (weatherSyncError) {
      console.error(
        "Automatic weather sync failed:",
        weatherSyncError,
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
          temperature: true,
          apparentTemperature: true,
          precipitation: true,
          rain: true,
          snowfall: true,
          windSpeed: true,
          windGusts: true,
          cloudCover: true,
          isDay: true,
          weatherCode: true,
        },
      });

    const weather =
      buildCustomerWeatherIntelligence(
        customer.bookings,
        weatherObservations,
      );

    const profileDataQuality =
      buildCustomerProfileDataQuality(
        customer.bookings,
        {
          weatherMatchedBookings:
            weather.matchedBookings,
        },
      );

    const bookingTimes = customer.bookings
      .map(
        (booking) =>
          booking.pickupDueTime ??
          booking.bookedAtTime,
      )
      .filter(
        (value): value is Date =>
          value !== null,
      );

    const contextualWindowMilliseconds =
      2 * 60 * 60 * 1000;

    const earliestBookingTime =
      bookingTimes.length > 0
        ? Math.min(
            ...bookingTimes.map(
              (value) =>
                value.getTime(),
            ),
          )
        : null;

    const latestBookingTime =
      bookingTimes.length > 0
        ? Math.max(
            ...bookingTimes.map(
              (value) =>
                value.getTime(),
            ),
          )
        : null;

    const contextualEvents =
      earliestBookingTime !== null &&
      latestBookingTime !== null
        ? await prisma.contextualCalendarEvent.findMany({
            where: {
              active: true,
              startsAt: {
                lte: new Date(
                  latestBookingTime +
                    contextualWindowMilliseconds,
                ),
              },
              endsAt: {
                gt: new Date(
                  earliestBookingTime -
                    contextualWindowMilliseconds,
                ),
              },
            },
            orderBy: {
              startsAt: "asc",
            },
            select: {
              id: true,
              title: true,
              category: true,
              startsAt: true,
              endsAt: true,
              locationName: true,
              impactLevel: true,
              source: true,
            },
          })
        : [];

    const contextualIntelligence =
      buildCustomerContextualIntelligence(
        customer.bookings,
        contextualEvents,
      );

    const identifiedPlaces = new Map<
      string,
      {
        id: string;
        name: string | null;
        formattedAddress: string | null;
        category: string | null;
        website: string | null;
        confidence: number | null;
        isSensitive: boolean;
        bookingIds: Set<string>;
        pickupMatches: number;
        destinationMatches: number;
      }
    >();

    let matchedPlaceLocations = 0;

    for (const booking of customer.bookings) {
      for (const location of booking.locations) {
        const place = location.placeIntelligence;

        if (!place || place.status !== "READY") {
          continue;
        }

        matchedPlaceLocations += 1;

        const existing =
          identifiedPlaces.get(place.id) ?? {
            id: place.id,
            name: place.isSensitive
              ? null
              : place.placeName,
            formattedAddress: place.isSensitive
              ? null
              : place.formattedAddress,
            category: place.isSensitive
              ? null
              : place.category,
            website: place.isSensitive
              ? null
              : place.website,
            confidence:
              place.confidence === null
                ? null
                : Number(place.confidence),
            isSensitive: place.isSensitive,
            bookingIds: new Set<string>(),
            pickupMatches: 0,
            destinationMatches: 0,
          };

        existing.bookingIds.add(
          booking.externalId,
        );

        if (location.type === "PICKUP") {
          existing.pickupMatches += 1;
        }

        if (location.type === "DESTINATION") {
          existing.destinationMatches += 1;
        }

        identifiedPlaces.set(
          place.id,
          existing,
        );
      }
    }

    const customerPlaceIntelligence = {
      matchedLocations: matchedPlaceLocations,
      distinctPlaces: identifiedPlaces.size,
      protectedPlaces: Array.from(
        identifiedPlaces.values(),
      ).filter((place) => place.isSensitive)
        .length,
      places: Array.from(
        identifiedPlaces.values(),
      )
        .map((place) => ({
          id: place.id,
          name: place.isSensitive
            ? "Protected location"
            : place.name,
          formattedAddress: place.isSensitive
            ? null
            : place.formattedAddress,
          category: place.isSensitive
            ? "Protected category"
            : place.category,
          website: place.isSensitive
            ? null
            : place.website,
          confidence: place.confidence,
          isSensitive: place.isSensitive,
          linkedBookings:
            place.bookingIds.size,
          bookingIds: Array.from(
            place.bookingIds,
          ).slice(0, 10),
          pickupMatches:
            place.pickupMatches,
          destinationMatches:
            place.destinationMatches,
        }))
        .sort(
          (first, second) =>
            second.linkedBookings -
            first.linkedBookings,
        ),
    };

    let profileHistory:
      Awaited<
        ReturnType<
          typeof getCustomerProfileHistory
        >
      > = [];

    try {
      await saveCustomerProfileSnapshot({
        customerId: customer.id,
        profile,
        needPropensity,
        relationshipQuality,
        customerRhythm,
        returnJourney,
        serviceOutcomes,
        profileDataQuality,
        behaviourChange,
      });

      profileHistory =
        await getCustomerProfileHistory(
          customer.id,
        );
    } catch (snapshotError) {
      console.error(
        "Customer profile snapshot failed:",
        snapshotError,
      );
    }

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.displayName,
        telephoneNumber:
          customer.telephoneNumber,
        email: customer.email,
        firstBookingAt:
          customer.firstBookingAt,
        lastBookingAt:
          customer.lastBookingAt,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      profile,
      profileDataQuality,
      profileHistory,
      nextBookingPrediction,
      bookingWindow,
      needPropensity,
      customerRhythm,
      operationalPreferences,
      relationshipQuality,
      serviceOutcomes,
      behaviourChange,
      returnJourney,
      contextualIntelligence,
      placeIntelligence:
        customerPlaceIntelligence,
      generatedAt: new Date(),
      observation: weather,
    });
  } catch (error) {
    console.error(
      "Customer profile request failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error: "CUSTOMER_PROFILE_FAILED",
        message:
          "Customer profile could not be generated.",
      },
      {
        status: 500,
      },
    );
  }
}
