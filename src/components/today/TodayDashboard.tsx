"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { comparisonDelta } from "@/lib/today/comparison";
import type { TodayBusinessSummary } from "@/lib/today/business-day";

type Widget =
  | "booked"
  | "pickups"
  | "completed"
  | "profit"
  | "revenue"
  | "cancelled"
  | "failed";
type Focus = "business" | "operations" | "exceptions";
const presets: Record<Focus, Widget[]> = {
  business: ["revenue", "profit", "booked", "completed"],
  operations: ["pickups", "booked", "completed", "cancelled"],
  exceptions: ["cancelled", "failed", "pickups"],
};
const labels: Record<Widget, string> = {
  booked: "Bookings received",
  pickups: "Pickups scheduled",
  completed: "Journeys completed",
  revenue: "Recorded revenue",
  profit: "Company profit",
  cancelled: "Cancellations",
  failed: "Processing failures",
};

export default function TodayDashboard({
  userId,
  name,
  summary,
  failureHref,
}: {
  userId: string;
  name: string;
  summary: TodayBusinessSummary;
  failureHref: string;
}) {
  const router = useRouter();
  const key = `taxicrm-today-v1:${userId}`;
  const available = (Object.keys(labels) as Widget[]).filter((id) =>
    id === "profit" ? summary.revenue !== null : summary[id] !== null,
  );
  const [selected, setSelected] = useState<Widget[]>([]);
  const [draft, setDraft] = useState<Widget[]>([]);
  const [focus, setFocus] = useState<Focus>("business");
  const [step, setStep] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let saved: Widget[] | null = null;
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      if (value?.version === 1 && Array.isArray(value.widgets)) {
        saved = value.widgets.filter((id: Widget) => available.includes(id));
      }
    } catch {
      /* Fall back to setup if storage is unavailable or malformed. */
    }
    const defaults = presets.business.filter((id) => available.includes(id));
    setSelected(saved?.length ? saved : defaults);
    setDraft(saved?.length ? saved : defaults);
    setStep(saved?.length || !available.length ? null : 1);
    setReady(true);
    // The server owns permissions; rehydrate only for this account's available widgets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const notes: Record<Widget, string> = {
    profit:
      "Driver payouts and business expenses are needed to calculate profit.",
    booked: "Created today, up to now — including bookings for later dates.",
    pickups:
      "Pickup time falls today — includes future pickups and all statuses.",
    completed: "Journeys finished today, up to now.",
    revenue:
      "Completed and account no-fare events today. Existing company revenue rules; not profit.",
    cancelled: "Bookings cancelled today, up to now.",
    failed: "Events received today still marked FAILED; not connection health.",
  };
  function save() {
    const widgets = Array.from(new Set(draft)).filter((id) =>
      available.includes(id),
    );
    if (!widgets.length) return;
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, widgets }));
      setNotice("Your Today view is saved for this account in this browser.");
    } catch {
      setNotice(
        "This browser could not save your preferences. Your selection works for this visit.",
      );
    }
    setSelected(widgets);
    setStep(null);
  }
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-app-muted">
            Your business today
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-app-primary">
            Today
          </h1>
          <p className="mt-2 text-sm text-app-muted">
            Hello, {name}. Your business today, compared with yesterday.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-app-border bg-surface px-4 py-2 text-sm"
            onClick={() => {
              router.refresh();
              setNotice("Refreshing today's figures…");
            }}
          >
            Refresh
          </button>
          <button
            className="rounded-lg bg-brand px-4 py-2 text-sm text-white"
            onClick={() => {
              setDraft(selected);
              setStep(1);
            }}
          >
            Customize Today
          </button>
        </div>
      </header>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-app-muted">
        <span>
          {summary.date} · Europe/London · Today vs yesterday, up to{" "}
          {summary.comparisonTime}
        </span>
        <span>
          Updated{" "}
          {new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/London",
            timeStyle: "short",
          }).format(new Date(summary.generatedAt))}{" "}
          · Refresh for the latest figures
        </span>
      </div>
      {notice && (
        <p role="status" className="text-sm text-app-secondary">
          {notice}
        </p>
      )}
      {ready && step !== null && (
        <section
          aria-label="Today setup"
          className="rounded-xl border border-brand bg-surface p-5 sm:p-7"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-brand">
              SET UP YOUR TODAY · STEP {step} OF 3
            </span>
            <button
              className="text-sm text-app-muted"
              onClick={() => setStep(null)}
            >
              Set up later
            </button>
          </div>
          {step === 1 && (
            <>
              <h2 className="mt-4 text-xl font-semibold">
                What matters most to you today?
              </h2>
              <p className="mt-2 text-sm text-app-muted">
                Start with a focus. You can choose the individual figures next.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {(
                  [
                    [
                      "business",
                      "Business overview",
                      "Revenue, profit readiness and booking demand.",
                    ],
                    [
                      "operations",
                      "Daily operations",
                      "Scheduled pickups and today's booking activity.",
                    ],
                    [
                      "exceptions",
                      "What needs attention",
                      "Cancellations and recorded processing failures.",
                    ],
                  ] as const
                ).map(([id, title, description]) => (
                  <button
                    key={id}
                    aria-pressed={focus === id}
                    className={`rounded-xl border p-4 text-left ${focus === id ? "border-brand bg-brand-soft" : "border-app-border"}`}
                    onClick={() => {
                      setFocus(id);
                      setDraft(
                        presets[id].filter((widget) =>
                          available.includes(widget),
                        ),
                      );
                    }}
                  >
                    <span className="block font-semibold">{title}</span>
                    <span className="mt-2 block text-sm text-app-muted">
                      {description}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="mt-4 text-xl font-semibold">
                Which figures would you like to see?
              </h2>
              <p className="mt-2 text-sm text-app-muted">
                Choose at least one. Only figures available to your role appear
                here.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {available.map((id) => (
                  <label
                    key={id}
                    className="flex items-start gap-3 rounded-lg border border-app-border p-4"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 accent-[var(--brand)]"
                      checked={draft.includes(id)}
                      onChange={(event) =>
                        setDraft(
                          event.target.checked
                            ? [...draft, id]
                            : draft.filter((widget) => widget !== id),
                        )
                      }
                    />
                    <span>
                      <span className="block font-medium">{labels[id]}</span>
                      <span className="mt-1 block text-xs text-app-muted">
                        {notes[id]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="mt-4 text-xl font-semibold">
                Your daily business view
              </h2>
              <p className="mt-2 text-sm text-app-muted">
                {draft.map((id) => labels[id]).join(" · ")}
              </p>
              <p className="mt-4 text-sm text-app-secondary">
                Figures use Europe/London. Preferences are saved for your
                account in this browser. You can change them at any time.
              </p>
            </>
          )}
          <div className="mt-6 flex justify-end gap-3">
            {step > 1 && (
              <button
                className="rounded-lg border border-app-border px-4 py-2 text-sm"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            <button
              disabled={step > 1 && !draft.length}
              className="rounded-lg bg-brand px-5 py-2 text-sm text-white disabled:opacity-50"
              onClick={() => (step === 3 ? save() : setStep(step + 1))}
            >
              {step === 3 ? "Save my Today view" : "Continue"}
            </button>
          </div>
        </section>
      )}
      {!ready ? (
        <p className="text-sm text-app-muted">Loading your daily view…</p>
      ) : (
        <section
          aria-label="Today's business figures"
          className={`grid gap-4 sm:grid-cols-2 ${selected.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
        >
          {selected
            .filter((id) => available.includes(id))
            .map((id) => (
              <Link
                key={id}
                href={
                  id === "revenue" || id === "profit"
                    ? "/dashboard"
                    : id === "failed"
                      ? failureHref
                      : "/dashboard/bookings"
                }
                className="rounded-xl border border-app-border bg-surface p-5 shadow-card hover:border-brand"
              >
                <p className="text-sm font-medium text-app-secondary">
                  {labels[id]}
                </p>
                <p
                  className={`mt-3 font-semibold tabular-nums text-app-primary ${id === "profit" ? "text-xl" : "text-3xl"}`}
                >
                  {id === "profit"
                    ? "Cost data required"
                    : id === "revenue"
                      ? new Intl.NumberFormat("en-GB", {
                          style: "currency",
                          currency: "GBP",
                        }).format(summary[id]!)
                      : summary[id]?.toLocaleString("en-GB")}
                </p>
                {id !== "profit" &&
                  summary.yesterday[id] !== null &&
                  (() => {
                    const previous = summary.yesterday[id]!;
                    const { delta, percent } = comparisonDelta(
                      summary[id]!,
                      previous,
                    );
                    const money = (value: number) =>
                      new Intl.NumberFormat("en-GB", {
                        style: "currency",
                        currency: "GBP",
                      }).format(value);
                    const favourable =
                      id === "cancelled" || id === "failed"
                        ? delta < 0
                        : delta > 0;
                    return (
                      <div
                        className="mt-3 space-y-1 text-xs"
                        data-comparison={id}
                      >
                        <p
                          className={
                            delta === 0
                              ? "text-app-muted"
                              : favourable
                                ? "text-emerald-400"
                                : "text-amber-400"
                          }
                        >
                          {delta === 0
                            ? "No change"
                            : `${delta > 0 ? "+" : "−"}${id === "revenue" ? money(Math.abs(delta)) : Math.abs(delta).toLocaleString("en-GB")}`}
                          {percent !== null && delta !== 0
                            ? ` (${percent > 0 ? "+" : ""}${percent}%)`
                            : ""}
                          {percent === null && delta !== 0
                            ? " · no percentage baseline"
                            : ""}
                        </p>
                        <p className="text-app-muted">
                          Yesterday:{" "}
                          {id === "revenue"
                            ? money(previous)
                            : previous.toLocaleString("en-GB")}
                          {id === "pickups"
                            ? " · full-day schedule"
                            : ` · up to ${summary.comparisonTime}`}
                        </p>
                      </div>
                    );
                  })()}
                <p className="mt-3 text-xs leading-5 text-app-muted">
                  {notes[id]}
                </p>
                {id === "revenue" &&
                  (summary.missingAmounts > 0 ||
                    summary.yesterday.missingAmounts > 0) && (
                    <p className="mt-2 text-xs text-amber-400">
                      Partial amounts: {summary.missingAmounts} records today
                      and {summary.yesterday.missingAmounts} yesterday have
                      neither price nor cost.
                    </p>
                  )}
                <span className="mt-4 block text-xs font-medium text-brand">
                  View details →
                </span>
              </Link>
            ))}
        </section>
      )}
      {ready && !available.length && (
        <p className="rounded-xl border border-app-border bg-surface p-5 text-sm">
          No daily figures are available to your role. Ask your administrator
          for access.
        </p>
      )}
      <section className="rounded-xl border border-app-border bg-surface p-5">
        <h2 className="font-semibold">Your business at a glance</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-app-muted">
          Bookings received, scheduled pickups and completed journeys measure
          different events. Activity and revenue compare the same local time
          yesterday; scheduled pickups compare whole days. Records without the
          relevant timestamp are excluded from that figure. Today&apos;s revenue
          uses existing price/cost and account waiting-charge rules; it is not
          profit or a forecast.
        </p>
      </section>
    </div>
  );
}
