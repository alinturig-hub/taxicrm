"use client";

import type {
  BookingVia,
  BookingWorkspaceData,
} from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

function Stop({
  icon,
  title,
  address,
  zone,
  time,
}: {
  icon: string;
  title: string;
  address: string | null;
  zone?: string | null;
  time?: string | null;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-surface-subtle text-lg">
          {icon}
        </div>

        <div className="mt-2 h-full w-px bg-app-border" />
      </div>

      <div className="flex-1 pb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="app-label">{title}</p>

            <p className="mt-1 text-base font-semibold text-app-primary">
              {address || "Unknown address"}
            </p>

            {zone && (
              <p className="mt-1 text-sm text-app-muted">
                {zone}
              </p>
            )}
          </div>

          {time && (
            <div className="rounded-appMd bg-surface-subtle px-3 py-1 text-sm font-semibold text-app-secondary">
              {new Date(time).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookingJourney({
  booking,
}: Props) {
  return (
    <section className="rounded-appXl border border-app-border bg-white shadow-card">
      <div className="border-b border-app-border px-6 py-5">
        <h3 className="text-lg font-semibold text-app-primary">
          Journey
        </h3>

        <p className="mt-1 text-sm text-app-muted">
          Pickup, stops and destination
        </p>
      </div>

      <div className="p-6">

        <Stop
          icon="📍"
          title="Pickup"
          address={booking.pickup?.address ?? null}
          zone={booking.pickup?.zoneName}
          time={booking.pickupDueTime}
        />

        {booking.vias.map((via: BookingVia) => (
          <Stop
            key={via.id}
            icon="🟡"
            title={`Via ${via.position}`}
            address={via.address}
            zone={via.zoneName}
          />
        ))}

        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-surface-subtle text-lg">
              🏁
            </div>
          </div>

          <div className="flex-1">
            <p className="app-label">
              Destination
            </p>

            <p className="mt-1 text-base font-semibold text-app-primary">
              {booking.destination?.address ??
                "Unknown destination"}
            </p>

            {booking.destination?.zoneName && (
              <p className="mt-1 text-sm text-app-muted">
                {booking.destination.zoneName}
              </p>
            )}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-2 gap-px border-t border-app-border bg-app-border lg:grid-cols-4">

        <div className="bg-white p-5">
          <p className="app-label">
            Passengers
          </p>

          <p className="mt-2 text-2xl font-bold text-app-primary">
            {booking.passengers}
          </p>
        </div>

        <div className="bg-white p-5">
          <p className="app-label">
            Luggage
          </p>

          <p className="mt-2 text-2xl font-bold text-app-primary">
            {booking.luggage}
          </p>
        </div>

        <div className="bg-white p-5">
          <p className="app-label">
            Distance
          </p>

          <p className="mt-2 text-2xl font-bold text-app-primary">
            {booking.distance ??
              booking.estimatedDistance ??
              "—"}
          </p>
        </div>

        <div className="bg-white p-5">
          <p className="app-label">
            Estimated
          </p>

          <p className="mt-2 text-2xl font-bold text-app-primary">
            £
            {booking.estimatedPrice ??
              booking.price ??
              booking.fare ??
              "—"}
          </p>
        </div>

      </div>
    </section>
  );
}
