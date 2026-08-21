import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { buildCustomerProfile } from "@/lib/customers/customer-profiler";
import { prisma } from "@/lib/prisma";

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
      generatedAt: new Date(),
      observation: {
        weatherAvailable: false,
        weatherMessage:
          "Historical weather is not stored yet. Weather sensitivity will be enabled after weather observations are added.",
      },
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
