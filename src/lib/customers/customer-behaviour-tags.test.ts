import assert from "node:assert/strict";

import {
  buildCustomerBehaviourTags,
} from "./customer-behaviour-tags";

const now =
  new Date(
    "2026-09-16T12:00:00.000Z",
  );

function booking({
  pickupAt,
  bookedAt,
  pickup = "PL1",
  destination = "City Centre",
  destinationCategory,
  status = "COMPLETED",
}: {
  pickupAt: string;
  bookedAt?: string;
  pickup?: string;
  destination?: string;
  destinationCategory?: string;
  status?: string;
}) {
  const pickupDueTime =
    new Date(pickupAt);

  return {
    status,
    pickupDueTime,
    bookedAtTime:
      new Date(
        bookedAt ??
          new Date(
            pickupDueTime.getTime() -
              60 * 60_000,
          ).toISOString(),
      ),
    locations: [
      {
        type:
          "PICKUP" as const,
        address:
          pickup,
        zoneName:
          null,
      },
      {
      type:
        "DESTINATION" as const,
      address:
        destination,
      zoneName:
        null,
      placeIntelligence:
        destinationCategory
          ? {
              category:
                destinationCategory,
              categories: [
                destinationCategory,
              ],
              isSensitive:
                false,
              poiCategoryStatus:
                "READY",
            }
          : null,
    },
    ],
  };
}

function ids(
  bookings:
    ReturnType<typeof booking>[],
) {
  return new Set(
    buildCustomerBehaviourTags(
      bookings,
      now,
    ).map(
      (tag) =>
        tag.id,
    ),
  );
}

const shoppingBookings = [
  booking({
    pickupAt:
      "2026-09-15T10:00:00.000Z",
    destination:
      "Drake Circus Shopping Centre",
  }),
  booking({
    pickupAt:
      "2026-09-14T10:00:00.000Z",
    destination:
      "Tesco Supermarket",
  }),
  booking({
    pickupAt:
      "2026-09-13T10:00:00.000Z",
    destination:
      "Retail Park",
  }),
  booking({
    pickupAt:
      "2026-09-12T10:00:00.000Z",
  }),
  booking({
    pickupAt:
      "2026-09-11T10:00:00.000Z",
  }),
];

assert.equal(
  ids(shoppingBookings).has(
    "SHOPPING_USER",
  ),
  true,
  "Three of five completed shopping journeys should qualify.",
);

assert.equal(
  ids(
    shoppingBookings.slice(
      0,
      2,
    ),
  ).has(
    "SHOPPING_USER",
  ),
  false,
  "Two journeys must not qualify.",
);

const geoapifyShoppingBookings = [
  "2026-09-15T11:00:00.000Z",
  "2026-09-14T11:00:00.000Z",
  "2026-09-13T11:00:00.000Z",
].map((pickupAt) =>
  booking({
    pickupAt,
    destination:
      "Generic destination",
    destinationCategory:
      "commercial.shopping_mall",
  }),
);

assert.equal(
  ids(
    geoapifyShoppingBookings,
  ).has(
    "SHOPPING_USER",
  ),
  true,
  "Geoapify shopping categories should qualify without address keywords.",
);

const geoapifyBeautyBookings = [
  "2026-09-15T12:00:00.000Z",
  "2026-09-14T12:00:00.000Z",
  "2026-09-13T12:00:00.000Z",
].map((pickupAt) =>
  booking({
    pickupAt,
    destination:
      "Generic business",
    destinationCategory:
      "service.beauty.hairdresser",
  }),
);

assert.equal(
  ids(
    geoapifyBeautyBookings,
  ).has(
    "HAIR_BEAUTY_USER",
  ),
  true,
  "Geoapify hairdresser categories should produce a Hair & Beauty User tag.",
);

const geoapifyCafeBookings = [
  "2026-09-15T13:00:00.000Z",
  "2026-09-14T13:00:00.000Z",
  "2026-09-13T13:00:00.000Z",
].map((pickupAt) =>
  booking({
    pickupAt,
    destination:
      "Generic venue",
    destinationCategory:
      "catering.cafe.coffee_shop",
  }),
);

assert.equal(
  ids(
    geoapifyCafeBookings,
  ).has(
    "CAFE_USER",
  ),
  true,
  "Geoapify cafe categories should produce a Cafe User tag.",
);

const earlyMorningBookings = [
  "2026-09-15T04:30:00.000Z",
  "2026-09-14T05:00:00.000Z",
  "2026-09-13T05:30:00.000Z",
].map((pickupAt) =>
  booking({
    pickupAt,
  }),
);

assert.equal(
  ids(
    earlyMorningBookings,
  ).has(
    "EARLY_MORNING_USER",
  ),
  true,
  "London local early-morning journeys should qualify.",
);

const weekendBookings = [
  "2026-09-12T10:00:00.000Z",
  "2026-09-13T10:00:00.000Z",
  "2026-09-06T10:00:00.000Z",
  "2026-09-15T10:00:00.000Z",
].map((pickupAt) =>
  booking({
    pickupAt,
  }),
);

assert.equal(
  ids(weekendBookings).has(
    "WEEKEND_USER",
  ),
  true,
  "Three of four weekend journeys should qualify.",
);

const shortNoticeBookings = [
  booking({
    pickupAt:
      "2026-09-15T10:00:00.000Z",
    bookedAt:
      "2026-09-15T09:45:00.000Z",
  }),
  booking({
    pickupAt:
      "2026-09-14T10:00:00.000Z",
    bookedAt:
      "2026-09-14T09:40:00.000Z",
  }),
  booking({
    pickupAt:
      "2026-09-13T10:00:00.000Z",
    bookedAt:
      "2026-09-13T09:35:00.000Z",
  }),
  booking({
    pickupAt:
      "2026-09-12T10:00:00.000Z",
    bookedAt:
      "2026-09-12T08:00:00.000Z",
  }),
];

assert.equal(
  ids(
    shortNoticeBookings,
  ).has(
    "SHORT_NOTICE_BOOKER",
  ),
  true,
  "Three of four short-notice bookings should qualify.",
);

const regularRouteBookings = [
  "2026-09-15T10:00:00.000Z",
  "2026-09-14T10:00:00.000Z",
  "2026-09-13T10:00:00.000Z",
].map((pickupAt) =>
  booking({
    pickupAt,
    pickup:
      "Plymouth Station",
    destination:
      "Royal Parade",
  }),
);

assert.equal(
  ids(
    regularRouteBookings,
  ).has(
    "REGULAR_ROUTE_USER",
  ),
  true,
  "Three completed journeys on the same route should qualify.",
);

const oldBookings = [
  booking({
    pickupAt:
      "2026-08-20T10:00:00.000Z",
    destination:
      "Tesco Supermarket",
  }),
  booking({
    pickupAt:
      "2026-08-19T10:00:00.000Z",
    destination:
      "Tesco Supermarket",
  }),
  booking({
    pickupAt:
      "2026-08-18T10:00:00.000Z",
    destination:
      "Tesco Supermarket",
  }),
];

assert.equal(
  buildCustomerBehaviourTags(
    oldBookings,
    now,
  ).length,
  0,
  "Bookings outside the 14-day window must be ignored.",
);

console.log(
  "Customer behaviour tag tests passed.",
);
