"use client";

import StatusBadge from "@/components/ui/StatusBadge";
import type { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatDriver(booking: BookingWorkspaceData) {
  const fullName = [
    booking.driverForename,
    booking.driverSurname,
  ]
    .filter(Boolean)
    .join(" ");

  if (booking.driverCallSign && fullName) {
    return `#${booking.driverCallSign} · ${fullName}`;
  }

  if (booking.driverCallSign) {
    return `#${booking.driverCallSign}`;
  }

  if (fullName) {
    return fullName;
  }

  return "Unassigned";
}

function formatVehicle(booking: BookingWorkspaceData) {
  if (
    booking.vehicleCallSign &&
    booking.vehicleRegistration
  ) {
    return `#${booking.vehicleCallSign} · ${booking.vehicleRegistration}`;
  }

  if (booking.vehicleCallSign) {
    return `#${booking.vehicleCallSign}`;
  }

  if (booking.vehicleRegistration) {
    return booking.vehicleRegistration;
  }

  return "Unassigned";
}

export default function BookingWorkspaceHeader({
  booking,
}: Props) {
  return (
    <section className="overflow-hidden rounded-appXl border border-app-border bg-white shadow-card">
      <div className="border-b border-app-border bg-white px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-app-primary">
                Booking #{booking.externalId}
              </h2>

              <StatusBadge status={booking.status} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-app-muted">
              <span>{booking.provider}</span>
              <span aria-hidden="true">•</span>
              <span>
                Updated {formatDateTime(booking.updatedAt)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-10 rounded-appMd border border-app-border bg-white px-4 text-sm font-semibold text-app-secondary transition hover:border-app-border-strong hover:bg-surface-subtle hover:text-app-primary"
            >
              Call
            </button>

            <button
              type="button"
              className="h-10 rounded-appMd border border-app-border bg-white px-4 text-sm font-semibold text-app-secondary transition hover:border-app-border-strong hover:bg-surface-subtle hover:text-app-primary"
            >
              Message
            </button>

            <button
              type="button"
              className="h-10 rounded-appMd border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-app-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white px-6 py-5">
          <p className="app-label">Customer</p>
          <p className="mt-2 truncate text-base font-semibold text-app-primary">
            {booking.customerName || "Unknown customer"}
          </p>
          <p className="mt-1 truncate text-sm text-app-muted">
            {booking.telephoneNumber || "No telephone number"}
          </p>
        </div>

        <div className="bg-white px-6 py-5">
          <p className="app-label">Pickup time</p>
          <p className="mt-2 text-base font-semibold text-app-primary">
            {formatDateTime(booking.pickupDueTime)}
          </p>
          <p className="mt-1 truncate text-sm text-app-muted">
            {booking.pickup?.address || "Pickup unavailable"}
          </p>
        </div>

        <div className="bg-white px-6 py-5">
          <p className="app-label">Driver</p>
          <p className="mt-2 truncate text-base font-semibold text-app-primary">
            {formatDriver(booking)}
          </p>
          <p className="mt-1 truncate text-sm text-app-muted">
            {formatVehicle(booking)}
          </p>
        </div>

        <div className="bg-white px-6 py-5">
          <p className="app-label">Payment</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <p className="truncate text-base font-semibold text-app-primary">
              {booking.paymentType || "Not specified"}
            </p>

            <p className="shrink-0 text-lg font-bold text-app-primary">
              {formatCurrency(
                booking.price ?? booking.fare,
              )}
            </p>
          </div>

          <p className="mt-1 truncate text-sm text-app-muted">
            Booked {formatDateTime(booking.bookedAtTime)}
          </p>
        </div>
      </div>
    </section>
  );
}
