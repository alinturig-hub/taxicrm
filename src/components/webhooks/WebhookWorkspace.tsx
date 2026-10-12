"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type EventUrl = {
  id: string;
  displayName: string;
  eventType: string;
  endpointSlug: string;
  description: string | null;
  isEnabled: boolean;
  count: number;
  lastReceived: string | null;
  lastStatus: string | null;
  conditions: number;
};

/** Adapted from Need A Cab Plus's provider workspace; TaxiCRM retains its own receiver and data model. */
export default function WebhookWorkspace({
  events,
  baseUrl,
  keyHeader,
  canManage,
}: {
  events: EventUrl[];
  baseUrl: string;
  keyHeader: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<EventUrl | null>(null);
  const [busy, setBusy] = useState(false);
  async function change(event: EventUrl, remove = false) {
    if (
      remove &&
      !window.confirm(
        `Delete ${event.displayName} event URL? Received events will be preserved.`,
      )
    )
      return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/dashboard/autocab/webhooks/${event.id}`,
        {
          method: remove ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          ...(!remove
            ? {
                body: JSON.stringify({
                  displayName: event.displayName,
                  description: event.description,
                  isEnabled: event.isEnabled,
                }),
              }
            : {}),
        },
      );
      if (!response.ok) throw new Error("Unable to save.");
      setEditing(null);
      setNotice(
        remove
          ? "Event URL deleted. Received events preserved."
          : "Event URL saved.",
      );
      router.refresh();
    } catch {
      setNotice("Unable to save webhook configuration. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const enabled = events.filter((event) => event.isEnabled).length;
  const visible = events.filter((event) =>
    `${event.displayName} ${event.eventType} ${event.endpointSlug}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Webhook URL copied.");
    } catch {
      setNotice("Unable to copy. Select and copy the URL manually.");
    }
  }
  const button =
    "rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400";
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-blue-400">
            Configuration
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Webhook providers
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Configure event URLs for operational data received by TaxiCRM.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300">
          1 provider
        </span>
      </header>
      <div className="flex flex-wrap gap-3">
        <Link
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          href="/dashboard/configuration/webhooks/add"
        >
          + Add event URL
        </Link>
        <button
          className={button}
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          {pending ? "Refreshing…" : "↻ Refresh"}
        </button>
        <Link
          className={button}
          href="/dashboard/configuration/webhooks/events"
        >
          View received events
        </Link>
      </div>
      <p role="status" className="text-sm text-slate-300">
        {notice}
      </p>
      {editing && (
        <form
          className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void change(editing);
          }}
        >
          <h2 className="text-lg text-white">Edit event URL</h2>
          <label className="block text-sm text-slate-300">
            Event name
            <input
              required
              maxLength={200}
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
              value={editing.displayName}
              onChange={(event) =>
                setEditing({ ...editing, displayName: event.target.value })
              }
            />
          </label>
          <label className="block text-sm text-slate-300">
            Description
            <textarea
              maxLength={2000}
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
              value={editing.description || ""}
              onChange={(event) =>
                setEditing({ ...editing, description: event.target.value })
              }
            />
          </label>
          <label className="flex gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={editing.isEnabled}
              onChange={(event) =>
                setEditing({ ...editing, isEnabled: event.target.checked })
              }
            />
            Enable event URL
          </label>
          <p className="text-xs text-slate-400">
            Event type and receiver URL remain fixed to preserve the configured
            Autocab connection.
          </p>
          <div className="flex gap-3">
            <button className={button} disabled={busy} type="submit">
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              className={button}
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside
          className="border-b border-slate-800 bg-slate-950/60 p-4 lg:border-b-0 lg:border-r"
          aria-label="Webhook sources"
        >
          <div
            aria-current="true"
            className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4"
          >
            <h2 className="font-semibold text-white">Autocab</h2>
            <p className="mt-2 text-xs text-slate-400">
              {enabled}/{events.length} event URLs enabled
            </p>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Autocab is the currently supported provider.
          </p>
        </aside>
        <div className="min-w-0 space-y-6 p-4 sm:p-6">
          <header>
            <p className="text-xs uppercase tracking-widest text-blue-400">
              Webhook source
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Autocab</h2>
            <p className="mt-2 text-sm text-slate-400">
              Booking, driver and vehicle events.
            </p>
          </header>
          <div className="grid overflow-hidden rounded-xl border border-slate-700 md:grid-cols-[140px_minmax(0,1fr)_180px]">
            <div className="p-4">
              <p className="text-xs uppercase text-slate-500">Configuration</p>
              <p className="mt-2 text-sm text-slate-200">
                {enabled ? "URLs enabled" : "No enabled URLs"}
              </p>
            </div>
            <div className="border-t border-slate-700 p-4 md:border-l md:border-t-0">
              <p className="text-xs uppercase text-slate-500">
                Main webhook URL
              </p>
              <code className="mt-2 block break-all text-xs text-blue-200">
                {baseUrl}
              </code>
            </div>
            <div className="border-t border-slate-700 p-4 md:border-l md:border-t-0">
              <p className="text-xs uppercase text-slate-500">
                Internal key header
              </p>
              <code className="mt-2 block break-all text-xs text-slate-200">
                {keyHeader}
              </code>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-400">
                Event URLs
              </p>
              <h3 className="mt-2 text-xl text-white">
                Autocab events{" "}
                <span className="text-sm text-slate-400">
                  ({events.length})
                </span>
              </h3>
            </div>
            <input
              aria-label="Search webhook events"
              placeholder="Search events…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white sm:w-60"
            />
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {visible.map((event) => (
              <article
                key={event.id}
                className={`min-w-0 rounded-xl border border-slate-700 border-l-4 bg-slate-950/60 p-4 ${event.isEnabled ? "border-l-emerald-400" : "border-l-slate-500"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-white">
                      {event.displayName}
                    </h4>
                    <p className="mt-1 text-xs text-slate-400">
                      {event.eventType} ·{" "}
                      {event.isEnabled ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <strong className="text-lg text-white">
                      {event.count.toLocaleString("en-GB")}
                    </strong>
                    <p className="text-xs text-slate-500">received</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code
                    title={`${baseUrl}/${event.endpointSlug}`}
                    className="min-w-0 flex-1 select-all break-all text-xs text-blue-200"
                  >
                    {baseUrl}/{event.endpointSlug}
                  </code>
                  <button
                    className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    aria-label={`Copy ${event.displayName} URL`}
                    onClick={() =>
                      void copy(`${baseUrl}/${event.endpointSlug}`)
                    }
                  >
                    Copy
                  </button>
                </div>
                {canManage && (
                  <div className="mt-3 flex gap-3">
                    <button
                      className="text-xs text-blue-300"
                      disabled={busy}
                      onClick={() => setEditing({ ...event })}
                      aria-label={`Edit ${event.displayName}`}
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs text-red-300"
                      disabled={busy}
                      onClick={() => void change(event, true)}
                      aria-label={`Delete ${event.displayName}`}
                    >
                      Delete
                    </button>
                  </div>
                )}
                {event.description && (
                  <p className="mt-2 text-xs text-slate-400">
                    {event.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  {event.lastReceived
                    ? new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Europe/London",
                      }).format(new Date(event.lastReceived)) +
                      " · Europe/London"
                    : "No events received"}
                  {event.lastStatus ? ` · ${event.lastStatus}` : ""} ·{" "}
                  {event.conditions} active conditions
                </p>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
              {events.length
                ? "No events match your search."
                : "No event URLs configured. Add your first event URL above."}
            </p>
          )}
          <p className="text-xs text-slate-500">
            Enabled URLs describe configuration. Received counts include
            recorded webhook events; they do not confirm successful processing.
            Open received events to inspect processing results.
          </p>
        </div>
      </section>
    </div>
  );
}
