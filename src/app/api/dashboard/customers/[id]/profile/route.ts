import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { buildCustomerProfile } from "@/lib/customers/customer-profiler";
import { buildNextBookingPrediction } from "@/lib/customers/customer-next-booking";
import { buildCustomerRhythm } from "@/lib/customers/customer-rhythm";
import { buildCustomerOperationalPreferences } from "@/lib/customers/customer-operational-preferences";
import { buildCustomerRelationshipQuality } from "@/lib/customers/customer-relationship-quality";
import { buildCustomerBehaviourChange } from "@/lib/customers/customer-behaviour-change";
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

    const behaviourChange =
      buildCustomerBehaviourChange(
        customer.bookings,
      );

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

    const contextualEvents =
      bookingTimes.length > 0
        ? await prisma.contextualCalendarEvent.findMany({
            where: {
              active: true,
              startsAt: {
                lte: new Date(
                  Math.max(
                    ...bookingTimes.map(
                      (value) =>
                        value.getTime(),
                    ),
                  ),
                ),
              },
              endsAt: {
                gt: new Date(
                  Math.min(
                    ...bookingTimes.map(
                      (value) =>
                        value.getTime(),
                    ),
                  ),
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
      nextBookingPrediction,
      customerRhythm,
      operationalPreferences,
      relationshipQuality,
      behaviourChange,
      contextualIntelligence,
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
