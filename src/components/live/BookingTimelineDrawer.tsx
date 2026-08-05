"use client";

import { useEffect } from "react";

export type BookingTimelineEvent = {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  occurredAt: string;
};

export type BookingDrawerData = {
  id: string;
  externalId: string;
  status: string;

  customerName: string | null;

  driverCallSign: string | null;
  driverName: string | null;

  fare: number | null;
  price: number | null;

  pickupAddress: string | null;
  destinationAddress: string | null;

  timeline: BookingTimelineEvent[];
};

type Props = {
  booking: BookingDrawerData | null;
  open: boolean;
  onClose(): void;
};

function formatMoney(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function BookingTimelineDrawer({
  booking,
  open,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);

    return () =>
      window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={[
          "fixed inset-0 z-40 bg-black/60 transition-opacity",
          open
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <aside
        className={[
          "fixed right-0 top-0 z-50 h-screen w-full max-w-xl",
          "border-l border-slate-800 bg-slate-950 shadow-2xl",
          "transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {!booking ? null : (
          <>
            <header className="border-b border-slate-800 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-violet-400">
                    Booking
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-white">
                    #{booking.externalId}
                  </h2>

                  <span className="mt-3 inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
                    {booking.status}
                  </span>
                </div>

                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Info
                  label="Customer"
                  value={booking.customerName}
                />

                <Info
                  label="Driver"
                  value={booking.driverName}
                />

                <Info
                  label="Callsign"
                  value={booking.driverCallSign}
                />

                <Info
                  label="Fare"
                  value={formatMoney(booking.fare)}
                />

                <Info
                  label="Price"
                  value={formatMoney(booking.price)}
                />
              </div>

              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Route
                </p>

                <p className="mt-3 text-sm text-white">
                  {booking.pickupAddress ?? "Unknown pickup"}
                </p>

                <div className="my-3 border-l border-dashed border-slate-700 pl-4 text-xs text-slate-500">
                  Journey
                </div>

                <p className="text-sm text-white">
                  {booking.destinationAddress ??
                    "Unknown destination"}
                </p>
              </div>
            </header>

            <div className="overflow-y-auto p-6">
              <h3 className="mb-6 text-lg font-semibold text-white">
                Booking Timeline
              </h3>

              <div className="space-y-5">
                {booking.timeline.map((event) => (
                  <div
                    key={event.id}
                    className="relative pl-8"
                  >
                    <div className="absolute left-2 top-2 bottom-0 w-px bg-slate-700" />

                    <div className="absolute left-0 top-1 h-4 w-4 rounded-full bg-violet-500 ring-4 ring-slate-950" />

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="font-semibold text-white">
                          {event.title}
                        </h4>

                        <span className="font-mono text-xs text-slate-500">
                          {formatDate(event.occurredAt)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        {event.description ??
                          event.eventType}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-sm text-white">
        {value ?? "—"}
      </p>
    </div>
  );
}
