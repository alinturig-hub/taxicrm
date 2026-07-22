"use client";

import { BookingWorkspaceData } from "./types";

type Props = {
  booking: BookingWorkspaceData;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function BookingTimeline({ booking }: Props) {
  return (
    <div className="border-b bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Timeline
      </h3>

      <div className="space-y-4">
        {booking.timeline.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
            No timeline events.
          </div>
        ) : (
          booking.timeline.map((event) => (
            <div
              key={event.id}
              className="flex gap-4"
            >
              <div className="mt-1 h-3 w-3 rounded-full bg-blue-600" />

              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-medium">
                    {event.title}
                  </p>

                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(event.occurredAt)}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {event.description ?? "-"}
                </p>

                <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                  {event.source} • {event.eventType}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
