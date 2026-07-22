"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
  onOpenBooking?: (bookingId: string) => void;
};

function formatCurrency(value: number | null | undefined) {
  if (value == null) {
    return "£0.00";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-GB");
}

export default function BookingCustomer({
  booking,
  onOpenBooking,
}: Props) {
  const customer = booking.customer;

  return (
    <div className="border-b bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Customer
      </h3>

      <div className="space-y-4">

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Name
          </p>

          <p className="font-medium">
            {booking.customerName ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Telephone
          </p>

          <p className="font-medium">
            {booking.telephoneNumber ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Email
          </p>

          <p className="font-medium break-all">
            {booking.customerEmail ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Reference
          </p>

          <p className="font-medium">
            {booking.ourReference ?? "-"}
          </p>
        </div>

        {customer ? (
          <>
            <div className="mt-6 border-t pt-5">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer Intelligence
              </h4>

              <div className="grid grid-cols-2 gap-3">

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">
                    Total Bookings
                  </div>

                  <div className="mt-1 text-lg font-bold">
                    {customer.totalBookings}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">
                    Completed
                  </div>

                  <div className="mt-1 text-lg font-bold">
                    {customer.completedBookings}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">
                    Cancelled
                  </div>

                  <div className="mt-1 text-lg font-bold">
                    {customer.cancelledBookings}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">
                    Average Spend
                  </div>

                  <div className="mt-1 text-lg font-bold">
                    {formatCurrency(customer.averageBookingValue)}
                  </div>
                </div>

              </div>

              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <div className="text-xs uppercase text-slate-500">
                  Lifetime Value
                </div>

                <div className="mt-1 text-2xl font-bold">
                  {formatCurrency(customer.totalValue)}
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  Last booking: {formatDate(customer.lastBookingAt)}
                </div>
              </div>

              <div className="mt-6">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Recent Bookings
                </h4>

                <div className="space-y-3">
                  {customer.recentBookings.length === 0 ? (
                    <div className="text-sm text-slate-500">
                      No previous bookings.
                    </div>
                  ) : (
                    customer.recentBookings.map((item) => {
                      const isCurrentBooking = item.id === booking.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isCurrentBooking || !onOpenBooking}
                          onClick={() => onOpenBooking?.(item.id)}
                          className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-slate-900">
                                Booking #{item.externalId}
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {item.status}
                                {isCurrentBooking ? " · Current booking" : ""}
                              </div>
                            </div>

                            <span className="shrink-0 text-xs text-slate-500">
                              {formatDate(
                                item.bookedAtTime ??
                                  item.pickupDueTime,
                              )}
                            </span>
                          </div>

                          <div className="mt-3 text-sm text-slate-600">
                            {item.pickupAddress ?? "-"}
                          </div>

                          <div className="text-sm text-slate-400">
                            →
                          </div>

                          <div className="text-sm text-slate-600">
                            {item.destinationAddress ?? "-"}
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">
                              {formatCurrency(
                                item.price ?? item.fare,
                              )}
                            </span>

                            {!isCurrentBooking ? (
                              <span className="text-xs font-semibold text-blue-600">
                                Open booking →
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}

      </div>
    </div>
  );
}
