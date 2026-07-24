"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type WebhookStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED"
  | "IGNORED";

type WebhookEvent = {
  id: string;
  provider: string;
  eventType: string;
  externalBookingId: string | null;
  idempotencyKey?: string;
  status: WebhookStatus;
  payload?: unknown;
  headers?: unknown;
  processingError?: string | null;
  attemptCount?: number;
  receivedAt: string;
  processedAt?: string | null;
  updatedAt?: string;
  bookingId?: string | null;
  webhookConfigurationId?: string | null;
};

type EventDetailResponse =
  | WebhookEvent
  | {
      event?: WebhookEvent;
      data?: WebhookEvent;
    };

const STATUS_OPTIONS: Array<{
  value: "ALL" | WebhookStatus;
  label: string;
}> = [
  { value: "ALL", label: "All statuses" },
  { value: "RECEIVED", label: "Received" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PROCESSED", label: "Processed" },
  { value: "FAILED", label: "Failed" },
  { value: "IGNORED", label: "Ignored" },
];

function parseEventList(value: unknown): WebhookEvent[] {
  if (Array.isArray(value)) {
    return value as WebhookEvent[];
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const response = value as {
    events?: unknown;
    data?: unknown;
    items?: unknown;
  };

  if (Array.isArray(response.events)) {
    return response.events as WebhookEvent[];
  }

  if (Array.isArray(response.data)) {
    return response.data as WebhookEvent[];
  }

  if (Array.isArray(response.items)) {
    return response.items as WebhookEvent[];
  }

  return [];
}

function parseEventDetail(value: EventDetailResponse): WebhookEvent | null {
  if ("id" in value && typeof value.id === "string") {
    return value;
  }

  if ("event" in value && value.event) {
    return value.event;
  }

  if ("data" in value && value.data) {
    return value.data;
  }

  return null;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatProcessingTime(event: WebhookEvent): string {
  if (!event.processedAt) {
    if (event.status === "PROCESSING") {
      return "Processing";
    }

    return "—";
  }

  const receivedAt = new Date(event.receivedAt).getTime();
  const processedAt = new Date(event.processedAt).getTime();

  if (
    Number.isNaN(receivedAt) ||
    Number.isNaN(processedAt) ||
    processedAt < receivedAt
  ) {
    return "—";
  }

  const duration = processedAt - receivedAt;

  if (duration < 1000) {
    return `${duration} ms`;
  }

  if (duration < 60000) {
    return `${(duration / 1000).toFixed(2)} s`;
  }

  return `${(duration / 60000).toFixed(2)} min`;
}

function statusClasses(status: WebhookStatus): string {
  switch (status) {
    case "PROCESSED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    case "FAILED":
      return "border-red-500/20 bg-red-500/10 text-red-300";
    case "PROCESSING":
      return "border-blue-500/20 bg-blue-500/10 text-blue-300";
    case "IGNORED":
      return "border-slate-600 bg-slate-800 text-slate-400";
    case "RECEIVED":
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }
}

function JsonBlock({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h3>

      <pre className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-300">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </section>
  );
}

export default function WebhookEventsPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [selectedEvent, setSelectedEvent] =
    useState<WebhookEvent | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"ALL" | WebhookStatus>("ALL");
  const [eventTypeFilter, setEventTypeFilter] = useState("ALL");
  const [providerFilter, setProviderFilter] = useState("ALL");

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadEvents = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await fetch(
        "/api/dashboard/autocab/events?limit=100",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const body = (await response.json()) as unknown;

      if (!response.ok) {
        const apiError = body as {
          message?: string;
          error?: string;
        };

        throw new Error(
          apiError.message ??
            apiError.error ??
            "Webhook events could not be loaded.",
        );
      }

      setEvents(parseEventList(body));
      setLastUpdated(new Date());
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Webhook events could not be loaded.",
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadEvents(true);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoRefresh, loadEvents]);

  async function openEvent(event: WebhookEvent) {
    setSelectedEvent(event);
    setDetailLoading(true);

    try {
      const response = await fetch(
        `/api/dashboard/autocab/events/${event.id}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as EventDetailResponse;
      const detail = parseEventDetail(body);

      if (detail) {
        setSelectedEvent(detail);
      }
    } catch {
      // Lista poate conține deja suficiente date pentru afișarea evenimentului.
    } finally {
      setDetailLoading(false);
    }
  }

  const eventTypes = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .map((event) => event.eventType)
            .filter(Boolean),
        ),
      ).sort(),
    [events],
  );

  const providers = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .map((event) => event.provider)
            .filter(Boolean),
        ),
      ).sort(),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return events.filter((event) => {
      if (
        statusFilter !== "ALL" &&
        event.status !== statusFilter
      ) {
        return false;
      }

      if (
        eventTypeFilter !== "ALL" &&
        event.eventType !== eventTypeFilter
      ) {
        return false;
      }

      if (
        providerFilter !== "ALL" &&
        event.provider !== providerFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        event.id,
        event.eventType,
        event.provider,
        event.status,
        event.externalBookingId ?? "",
        event.idempotencyKey ?? "",
      ].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      );
    });
  }, [
    events,
    eventTypeFilter,
    providerFilter,
    search,
    statusFilter,
  ]);

  const statusCounts = useMemo(
    () => ({
      total: events.length,
      processing: events.filter(
        (event) =>
          event.status === "RECEIVED" ||
          event.status === "PROCESSING",
      ).length,
      processed: events.filter(
        (event) => event.status === "PROCESSED",
      ).length,
      failed: events.filter(
        (event) => event.status === "FAILED",
      ).length,
    }),
    [events],
  );

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
                  Configuration / Webhooks
                </p>

                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
                Webhook Event Monitor
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Monitor incoming Autocab events, processing status,
                execution time and complete raw JSON payloads.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/configuration/webhooks"
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700"
              >
                Configurations
              </Link>

              <button
                type="button"
                onClick={() => void loadEvents()}
                disabled={loading}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Refreshing..." : "Refresh now"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Recent Events
            </p>
            <p className="mt-3 text-3xl font-bold text-white">
              {statusCounts.total}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              In Progress
            </p>
            <p className="mt-3 text-3xl font-bold text-amber-300">
              {statusCounts.processing}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Processed
            </p>
            <p className="mt-3 text-3xl font-bold text-emerald-300">
              {statusCounts.processed}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">
              Failed
            </p>
            <p className="mt-3 text-3xl font-bold text-red-300">
              {statusCounts.failed}
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="grid gap-4 lg:grid-cols-4">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search booking, event or ID..."
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "ALL" | WebhookStatus,
                )
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={eventTypeFilter}
              onChange={(event) =>
                setEventTypeFilter(event.target.value)
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
            >
              <option value="ALL">All event types</option>

              {eventTypes.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>

            <select
              value={providerFilter}
              onChange={(event) =>
                setProviderFilter(event.target.value)
              }
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
            >
              <option value="ALL">All providers</option>

              {providers.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) =>
                  setAutoRefresh(event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-600 bg-slate-950"
              />
              Auto-refresh every 5 seconds
            </label>

            <p className="text-xs text-slate-500">
              {lastUpdated
                ? `Last updated ${formatDate(lastUpdated.toISOString())}`
                : "Waiting for first refresh"}
            </p>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 p-5">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Live Events
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {filteredEvents.length} of {events.length} recent
                events
              </p>
            </div>
          </div>

          {loading && events.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
              Loading webhook events...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="h-3 w-3 rounded-full bg-slate-600" />

              <h3 className="mt-5 text-lg font-semibold text-white">
                No webhook events found
              </h3>

              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Incoming Autocab webhooks will appear here automatically
                after they reach a configured TaxiCRM receiver endpoint.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-950/40">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Time
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Event
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Booking
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Processing
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Provider
                    </th>
                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {filteredEvents.map((event) => (
                    <tr
                      key={event.id}
                      className="transition hover:bg-slate-800/30"
                    >
                      <td className="whitespace-nowrap px-5 py-5 text-xs text-slate-400">
                        {formatDate(event.receivedAt)}
                      </td>

                      <td className="px-5 py-5">
                        <p className="whitespace-nowrap text-sm font-semibold text-white">
                          {event.eventType}
                        </p>
                        <p className="mt-1 max-w-48 truncate text-xs text-slate-600">
                          {event.id}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-sm text-slate-300">
                        {event.externalBookingId ?? "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            event.status,
                          )}`}
                        >
                          {event.status}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-sm text-slate-400">
                        {formatProcessingTime(event)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-sm font-medium text-slate-300">
                        {event.provider}
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => void openEvent(event)}
                          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20"
                        >
                          View JSON
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedEvent ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Webhook event details"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              setSelectedEvent(null);
            }
          }}
        >
          <aside className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-slate-800 bg-slate-900/95 p-6 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                  Webhook Event
                </p>

                <h2 className="mt-2 text-xl font-bold text-white">
                  {selectedEvent.eventType}
                </h2>

                <p className="mt-1 break-all text-xs text-slate-500">
                  {selectedEvent.id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-6 p-6">
              {detailLoading ? (
                <p className="text-sm text-slate-500">
                  Loading complete event details...
                </p>
              ) : null}

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-500">Status</p>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                      selectedEvent.status,
                    )}`}
                  >
                    {selectedEvent.status}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-500">
                    Processing Time
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatProcessingTime(selectedEvent)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-500">
                    External Booking ID
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold text-white">
                    {selectedEvent.externalBookingId ?? "Not available"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-xs text-slate-500">
                    Attempts
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {selectedEvent.attemptCount ?? 0}
                  </p>
                </div>
              </section>

              {selectedEvent.processingError ? (
                <section className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">
                    Processing Error
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-red-200">
                    {selectedEvent.processingError}
                  </p>
                </section>
              ) : null}

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Event Metadata
                </h3>

                <dl className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">
                      Provider
                    </dt>
                    <dd className="mt-1 text-slate-300">
                      {selectedEvent.provider}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">
                      Received
                    </dt>
                    <dd className="mt-1 text-slate-300">
                      {formatDate(selectedEvent.receivedAt)}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">
                      Processed
                    </dt>
                    <dd className="mt-1 text-slate-300">
                      {selectedEvent.processedAt
                        ? formatDate(selectedEvent.processedAt)
                        : "Not processed"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">
                      Idempotency Key
                    </dt>
                    <dd className="mt-1 break-all text-slate-300">
                      {selectedEvent.idempotencyKey ?? "Not available"}
                    </dd>
                  </div>
                </dl>
              </section>

              <JsonBlock
                title="Payload"
                value={selectedEvent.payload}
              />

              <JsonBlock
                title="Headers"
                value={selectedEvent.headers}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
