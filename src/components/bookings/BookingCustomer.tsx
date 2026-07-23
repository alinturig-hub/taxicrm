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

function getScoreClasses(
  color: "green" | "blue" | "purple" | "red",
) {
  const classes = {
    green:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue:
      "border-blue-200 bg-blue-50 text-blue-700",
    purple:
      "border-purple-200 bg-purple-50 text-purple-700",
    red:
      "border-red-200 bg-red-50 text-red-700",
  };

  return classes[color];
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

              <div className="mb-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                      AI Customer Summary
                    </div>

                    <div className="mt-2 text-base font-bold text-slate-900">
                      {customer.summary.headline}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                    Live Insight
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {customer.summary.overview}
                </p>

                {customer.summary.insights.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {customer.summary.insights.map(
                      (insight, index) => (
                        <div
                          key={`${insight}-${index}`}
                          className="flex items-start gap-2 text-sm text-slate-700"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />

                          <span>{insight}</span>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>

              <div
                className={`mb-4 rounded-lg border p-4 ${getScoreClasses(
                  customer.score.color,
                )}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">
                      {customer.score.label}
                    </div>

                    <div className="mt-1 text-xs opacity-80">
                      {customer.score.reason}
                    </div>
                  </div>

                  <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                    {customer.score.level ===
                    "HIGH_CANCELLATION_RISK"
                      ? "RISK"
                      : customer.score.level}
                  </div>
                </div>
              </div>

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
