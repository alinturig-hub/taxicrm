"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

export default function BookingJourney({ booking }: Props) {
  return (
    <div className="border-b bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Journey
      </h3>

      <div className="space-y-4">

        <div className="flex gap-3">
          <div className="mt-1 text-lg">🟢</div>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Pickup
            </p>

            <p className="font-medium">
              {booking.pickup?.address ?? "-"}
            </p>

            {booking.pickup?.zoneName && (
              <p className="text-sm text-slate-500">
                {booking.pickup.zoneName}
              </p>
            )}
          </div>
        </div>

        {booking.vias.map((via) => (
          <div
            key={via.id}
            className="flex gap-3"
          >
            <div className="mt-1 text-lg">🟡</div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Via {via.position}
              </p>

              <p className="font-medium">
                {via.address}
              </p>

              {via.zoneName && (
                <p className="text-sm text-slate-500">
                  {via.zoneName}
                </p>
              )}
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <div className="mt-1 text-lg">🔴</div>

          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Destination
            </p>

            <p className="font-medium">
              {booking.destination?.address ?? "-"}
            </p>

            {booking.destination?.zoneName && (
              <p className="text-sm text-slate-500">
                {booking.destination.zoneName}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
