"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

function money(value: number | null) {
  if (value === null) return "-";
  return `£${value.toFixed(2)}`;
}

function distance(value: number | null) {
  if (value === null) return "-";
  return `${value.toFixed(2)} mi`;
}

export default function BookingPricing({ booking }: Props) {
  return (
    <div className="border-b bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Pricing
      </h3>

      <div className="grid grid-cols-2 gap-4">

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Fare
          </p>

          <p className="font-medium">
            {money(booking.fare)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Price
          </p>

          <p className="font-medium">
            {money(booking.price)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Cost
          </p>

          <p className="font-medium">
            {money(booking.cost)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Distance
          </p>

          <p className="font-medium">
            {distance(booking.distance)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Estimated Price
          </p>

          <p className="font-medium">
            {money(booking.estimatedPrice)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Estimated Distance
          </p>

          <p className="font-medium">
            {distance(booking.estimatedDistance)}
          </p>
        </div>

      </div>
    </div>
  );
}
