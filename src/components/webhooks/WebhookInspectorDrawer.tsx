"use client";

import { useEffect, useState } from "react";

type WebhookConfiguration = {
  id: string;
  displayName: string;
  eventType: string;
  endpointSlug: string;
  description: string | null;
  isEnabled: boolean;
};

type TimelineEvent = {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  source: string;
  createdBy: string | null;
  metadata: unknown;
  occurredAt: string;
  createdAt: string;
};

type WebhookEventDetails = {
  id: string;
  provider: string;
  eventType: string;
  externalBookingId: string | null;
  bookingId: string | null;
  webhookConfigurationId: string | null;
  idempotencyKey: string;
  status: string;
  payload: unknown;
  payloadSize: number;
  headers: unknown;
  headersSize: number;
  processingError: string | null;
  attemptCount: number;
  receivedAt: string;
  processedAt: string | null;
  updatedAt: string;
  webhookConfiguration: WebhookConfiguration | null;
  timelineEvents: TimelineEvent[];
};

type WebhookInspectorDrawerProps = {
  eventId: string | null;
  onClose: () => void;
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to format JSON.";
  }
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

export default function WebhookInspectorDrawer({
  eventId,
  onClose,
}: WebhookInspectorDrawerProps) {
  const [event, setEvent] = useState<WebhookEventDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<
    "payload" | "headers" | null
  >(null);

  useEffect(() => {
    if (!eventId) {
      setEvent(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadEvent() {
      setLoading(true);
      setError(null);
      setEvent(null);

      try {
        const response = await fetch(
          `/api/dashboard/autocab/events/${encodeURIComponent(eventId!)}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result = (await response.json()) as {
          success: boolean;
          event?: WebhookEventDetails;
          message?: string;
        };

        if (!response.ok || !result.success || !result.event) {
          throw new Error(
            result.message || "The webhook event could not be loaded.",
          );
        }

        setEvent(result.event);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "The webhook event could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadEvent();

    return () => {
      controller.abort();
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [eventId, onClose]);

  async function copyJson(
    section: "payload" | "headers",
    value: unknown,
  ) {
    try {
      await navigator.clipboard.writeText(formatJson(value));
      setCopiedSection(section);

      window.setTimeout(() => {
        setCopiedSection(null);
      }, 1500);
    } catch {
      setCopiedSection(null);
    }
  }

  if (!eventId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close webhook inspector"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Webhook event inspector"
        className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-slate-800 bg-slate-950 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
              Webhook Inspector
            </p>
            <h2 className="mt-2 truncate text-xl font-bold text-white">
              {event?.eventType || "Loading event..."}
            </h2>
            <p className="mt-1 truncate font-mono text-xs text-slate-500">
              {eventId}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {loading && (
            <div className="flex min-h-64 items-center justify-center">
              <p className="text-sm text-slate-400">
                Loading webhook event...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="font-semibold text-red-300">
                Unable to load event
              </p>
              <p className="mt-2 text-sm text-red-200/80">{error}</p>
            </div>
          )}

          {event && !loading && (
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-5 py-4">
                  <h3 className="font-semibold text-white">Summary</h3>
                </div>

                <dl className="grid gap-px bg-slate-800 sm:grid-cols-2">
                  <div className="bg-slate-900 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Provider
                    </dt>
                    <dd className="mt-2 text-sm font-semibold text-white">
                      {event.provider}
                    </dd>
                  </div>

                  <div className="bg-slate-900 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Status
                    </dt>
                    <dd className="mt-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                          event.status,
                        )}`}
                      >
                        {event.status}
                      </span>
                    </dd>
                  </div>

                  <div className="bg-slate-900 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      External Booking ID
                    </dt>
                    <dd className="mt-2 break-all font-mono text-sm text-slate-300">
                      {event.externalBookingId || "—"}
                    </dd>
                  </div>

                  <div className="bg-slate-900 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Internal Booking ID
                    </dt>
                    <dd className="mt-2 break-all font-mono text-sm text-slate-300">
                      {event.bookingId || "—"}
                    </dd>
                  </div>

                  <div className="bg-slate-900 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Received
                    </dt>
                    <dd className="mt-2 text-sm text-slate-300">
                      {formatDate(event.receivedAt)}
                    </dd>
                  </div>

                  <div className="bg-slate-900 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Processed
                    </dt>
                    <dd className="mt-2 text-sm text-slate-300">
                      {formatDate(event.processedAt)}
                    </dd>
                  </div>

                  <div className="bg-slate-900 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Attempts
                    </dt>
                    <dd className="mt-2 text-sm font-semibold text-white">
                      {event.attemptCount}
                    </dd>
                  </div>

                  <div className="bg-slate-900 p-4">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      Updated
                    </dt>
                    <dd className="mt-2 text-sm text-slate-300">
                      {formatDate(event.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-5 py-4">
                  <h3 className="font-semibold text-white">
                    Webhook Configuration
                  </h3>
                </div>

                <div className="p-5">
                  {event.webhookConfiguration ? (
                    <dl className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Display Name
                        </dt>
                        <dd className="mt-2 text-sm text-white">
                          {event.webhookConfiguration.displayName}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Endpoint Slug
                        </dt>
                        <dd className="mt-2 font-mono text-sm text-slate-300">
                          {event.webhookConfiguration.endpointSlug}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Enabled
                        </dt>
                        <dd className="mt-2 text-sm text-white">
                          {event.webhookConfiguration.isEnabled
                            ? "Yes"
                            : "No"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">
                          Description
                        </dt>
                        <dd className="mt-2 text-sm text-slate-300">
                          {event.webhookConfiguration.description || "—"}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No webhook configuration is linked to this event.
                    </p>
                  )}
                </div>
              </section>

              {event.processingError && (
                <section className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                  <h3 className="font-semibold text-red-300">
                    Processing Error
                  </h3>
                  <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-red-200/80">
                    {event.processingError}
                  </pre>
                </section>
              )}

              <section className="rounded-xl border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                  <div>
                    <h3 className="font-semibold text-white">Payload</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatBytes(event.payloadSize)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyJson("payload", event.payload)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                  >
                    {copiedSection === "payload"
                      ? "Copied"
                      : "Copy JSON"}
                  </button>
                </div>

                <pre className="max-h-[32rem] overflow-auto p-5 text-xs leading-6 text-emerald-300">
                  {formatJson(event.payload)}
                </pre>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                  <div>
                    <h3 className="font-semibold text-white">Headers</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatBytes(event.headersSize)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyJson("headers", event.headers)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                  >
                    {copiedSection === "headers"
                      ? "Copied"
                      : "Copy JSON"}
                  </button>
                </div>

                <pre className="max-h-96 overflow-auto p-5 text-xs leading-6 text-blue-300">
                  {formatJson(event.headers)}
                </pre>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-5 py-4">
                  <h3 className="font-semibold text-white">
                    Timeline Events
                  </h3>
                </div>

                <div className="p-5">
                  {event.timelineEvents.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No timeline events are linked to this webhook.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {event.timelineEvents.map((timelineEvent) => (
                        <div
                          key={timelineEvent.id}
                          className="border-l-2 border-blue-500/40 pl-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-white">
                              {timelineEvent.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(timelineEvent.occurredAt)}
                            </p>
                          </div>

                          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-blue-400">
                            {timelineEvent.eventType}
                          </p>

                          {timelineEvent.description && (
                            <p className="mt-2 text-sm text-slate-400">
                              {timelineEvent.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Idempotency Key
                </p>
                <p className="mt-2 break-all font-mono text-xs text-slate-300">
                  {event.idempotencyKey}
                </p>
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
