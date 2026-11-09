"use client";
import { useEffect, useRef, useState } from "react";

type Item = { id: string; reference: string; status: "CANCELLED" | "NO_FARE"; bookedAt: string | null; eventAt: string | null };
function date(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(parsed) + " · London" : "Not recorded";
}
export default function CustomerOutcomeHistory({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<Item[]>([]), [cursor, setCursor] = useState<string | null>(null), [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function load(next?: string) {
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError("");
    try {
      const query = next ? `?cursor=${encodeURIComponent(next)}` : "";
      const response = await fetch(`/api/dashboard/customers/${encodeURIComponent(customerId)}/outcomes${query}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 403 ? "You do not have permission to view this history." : "History could not be loaded. Try again.");
      const data = await response.json() as { items: Item[]; nextCursor: string | null };
      if (!Array.isArray(data.items)) throw new Error("History could not be loaded. Try again.");
      if (controller.signal.aborted) return;
      setItems(old => next ? [...old, ...data.items] : data.items); setCursor(data.nextCursor); setLoaded(true);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "History could not be loaded."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section aria-label="Cancellation and no-fare history" className="rounded-2xl border border-app-border bg-surface p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Cancellation and no-fare history</h3><p className="mt-2 text-sm text-app-muted">Bookings linked to this profile, ordered by booking time. A status does not explain what happened or who was responsible.</p></div><button type="button" onClick={() => void load()} disabled={busy} className="rounded-lg border border-app-border px-3 py-2 text-sm disabled:opacity-40">{busy ? "Loading…" : loaded ? "Refresh history" : "Load history"}</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    {loaded && !busy && !error && items.length === 0 && <p className="mt-4 text-sm text-app-muted">No cancellations or no-fares recorded for this profile.</p>}
    {items.length > 0 && <ul className="mt-4 space-y-2">{items.map(item => <li key={item.id} className="rounded-xl border border-app-border p-3 text-sm"><p className="font-semibold">{item.status === "NO_FARE" ? "No fare" : "Cancelled"} · Booking {item.reference}</p><p className="mt-1 text-app-muted">Event time: {date(item.eventAt)} · Booked: {date(item.bookedAt)}</p></li>)}</ul>}
    {cursor && <button type="button" disabled={busy} onClick={() => void load(cursor)} className="mt-4 rounded-lg border border-app-border px-3 py-2 text-sm disabled:opacity-40">{busy ? "Loading…" : "Load older bookings"}</button>}
  </section>;
}
