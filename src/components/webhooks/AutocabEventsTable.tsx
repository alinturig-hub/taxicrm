"use client";

import { useState } from "react";
import WebhookInspectorDrawer from "./WebhookInspectorDrawer";

type WebhookEventRow = {
  id: string;
  eventType: string;
  externalBookingId: string | null;
  status: string;
  receivedAt: Date;
  processedAt: Date | null;
};

type Props = {
  events: WebhookEventRow[];
};

function formatDate(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function getStatusClass(status: string) {
  switch (status) {
    case "PROCESSED":
      return "bg-emerald-500/10 text-emerald-400";

    case "FAILED":
      return "bg-red-500/10 text-red-400";

    case "PROCESSING":
      return "bg-amber-500/10 text-amber-400";

    case "IGNORED":
      return "bg-slate-700 text-slate-300";

    default:
      return "bg-blue-500/10 text-blue-400";
  }
}

export default function AutocabEventsTable({
  events,
}: Props) {
  const [selectedEventId, setSelectedEventId] =
    useState<string | null>(null);

  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Live Webhook Events
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Click pe un eveniment pentru
                detalii complete.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">

            <thead className="bg-slate-950/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Received
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Event
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Booking
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Processed
                </th>

                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">

              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Nu există webhook-uri.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() =>
                      setSelectedEventId(event.id)
                    }
                    className="cursor-pointer transition hover:bg-slate-800/60"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">
                      {formatDate(event.receivedAt)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">
                      {event.eventType}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-slate-300">
                      {event.externalBookingId ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                          event.status,
                        )}`}
                      >
                        {event.status}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                      {formatDate(event.processedAt)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                        }}
                        className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/20"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>      <WebhookInspectorDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />
    </>
  );
}