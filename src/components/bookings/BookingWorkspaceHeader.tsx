"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusColor(status: string) {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "CANCELLED":
      return "bg-red-100 text-red-700";
    case "DISPATCHED":
      return "bg-blue-100 text-blue-700";
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function BookingWorkspaceHeader({ booking }: Props) {
  return (
    <div className="border-b bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">
            Booking #{booking.externalId}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {booking.provider}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor(
            booking.status,
          )}`}
        >
          {booking.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Customer</p>
          <p className="font-medium">
            {booking.customerName ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Telephone</p>
          <p className="font-medium">
            {booking.telephoneNumber ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Pickup Time</p>
          <p className="font-medium">
            {formatDate(booking.pickupDueTime)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Booked</p>
          <p className="font-medium">
            {formatDate(booking.bookedAtTime)}
          </p>
        </div>
      </div>
    </div>
  );
}
