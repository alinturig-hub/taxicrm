"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  cardLabels,
  cleanCards,
  defaultCards,
  topArea,
  type AnalyticsData,
  type CardId,
  type Preset,
  type Payment,
  type Totals,
} from "@/lib/analytics/explorer/model";
import ExecutiveOverview from "./ExecutiveOverview";
import DataCoverage from "./DataCoverage";
const AreaMap = dynamic(() => import("./AreaHeatMap"), {
  ssr: false,
  loading: () => (
    <div className="h-80 animate-pulse rounded-xl bg-surface">
      Loading zone map…
    </div>
  ),
});
const money = (n: number | null) =>
  n === null
    ? "Data required"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(n);
const number = (n: number) => n.toLocaleString("en-GB");
const presets: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "this-week", label: "This week" },
  { id: "last-hour", label: "Last hour" },
  { id: "last-6-hours", label: "Last 6 hours" },
  { id: "last-12-hours", label: "Last 12 hours" },
  { id: "custom", label: "Custom dates" },
];
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const areaMetric: Partial<Record<CardId, keyof Totals>> = {
  profitableArea: "margin",
  noFareArea: "noFare",
  cancelledArea: "cancelled",
  rejectedArea: "rejected",
  cashArea: "cash",
  accountArea: "account",
  cardArea: "card",
  prebookArea: "prebook",
  recoveredArea: "recovered",
  busyArea: "total",
};
function BarChart({
  rows,
  label,
  color = "bg-brand",
}: {
  rows: { label: string; count: number }[];
  label: string;
  color?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <>
      <div
        role="img"
        aria-label={label}
        className="flex h-48 items-end gap-1 pt-6"
      >
        {rows.map((r, i) => (
          <div
            key={r.label + ":" + i}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${r.label}: ${number(r.count)}`}
          >
            <div
              className={`min-h-[2px] rounded-t ${color}`}
              style={{
                height: `${(r.count / max) * 85}%`,
                opacity: 0.55 + (r.count / max) * 0.45,
              }}
            />
            <span className="mt-2 truncate text-center text-[10px] text-app-muted">
              {i % Math.max(1, Math.ceil(rows.length / 12)) === 0
                ? r.label
                : "·"}
            </span>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-surface px-2 py-1 text-xs shadow-lg group-hover:block">
              {number(r.count)}
            </span>
          </div>
        ))}
      </div>
      <details className="mt-3 text-xs text-app-muted">
        <summary className="cursor-pointer">View chart data</summary>
        <div className="mt-2 max-h-44 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Period</th>
                <th>Bookings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  <td>{number(r.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
function MoneyTrend({ rows }: { rows: AnalyticsData["revenueTrend"] }) {
  const min = Math.min(0, ...rows.flatMap((r) => [r.gross, r.driverMoney])),
    max = Math.max(1, ...rows.flatMap((r) => [r.gross, r.driverMoney]));
  const y = (n: number) => 150 - ((n - min) / (max - min)) * 130;
  const line = (key: "gross" | "driverMoney") =>
    rows
      .map(
        (r, i) =>
          `${i ? "L" : "M"}${20 + (i / Math.max(1, rows.length - 1)) * 600},${y(r[key])}`,
      )
      .join(" ");
  return (
    <>
      <div className="flex gap-5 text-xs">
        <span className="text-brand">● Gross income · Price</span>
        <span className="text-orange-400">● Driver money · Cost</span>
      </div>
      <svg
        viewBox="0 0 640 180"
        role="img"
        aria-label="Recorded gross income and driver money over the selected dates"
        className="mt-4 w-full"
      >
        <line
          x1="20"
          x2="620"
          y1={y(0)}
          y2={y(0)}
          stroke="currentColor"
          opacity=".15"
        />
        <path
          d={line("gross")}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
        />
        <path
          d={line("driverMoney")}
          fill="none"
          stroke="#fb923c"
          strokeWidth="3"
        />
        {rows.map((r, i) => (
          <circle
            key={r.date}
            cx={20 + (i / Math.max(1, rows.length - 1)) * 600}
            cy={y(r.gross)}
            r={rows.length < 40 ? 3 : 1}
            fill="var(--primary)"
          >
            <title>
              {r.date}: Price {money(r.gross)}, Cost {money(r.driverMoney)}
            </title>
          </circle>
        ))}
      </svg>
      <details className="text-xs text-app-muted">
        <summary className="cursor-pointer">View income data</summary>
        <div className="mt-2 max-h-44 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td>{r.date}</td>
                  <td>{money(r.gross)}</td>
                  <td>{money(r.driverMoney)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
function Panel({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-app-border bg-surface p-5">
      <h2 className="text-base font-semibold text-app-primary">{title}</h2>
      {sub && <p className="mt-1 text-xs leading-5 text-app-muted">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}
function cardValue(
  id: CardId,
  d: AnalyticsData,
): { value: string; detail: string } {
  const metric = areaMetric[id];
  if (metric) {
    const area = topArea(d.areas, metric);
    return {
      value: area?.name || "No qualifying area",
      detail: area
        ? metric === "margin"
          ? money(area.margin) + " recorded margin"
          : number(Number(area[metric])) + " bookings"
        : "Verified pickup zones only",
    };
  }
  if (
    [
      "gross",
      "cashIncome",
      "accountIncome",
      "cardIncome",
      "driverMoney",
      "margin",
    ].includes(id)
  )
    return {
      value: money(
        d.totals[
          id as
            | "gross"
            | "cashIncome"
            | "accountIncome"
            | "cardIncome"
            | "driverMoney"
            | "margin"
        ],
      ),
      detail:
        id === "margin"
          ? "Before rent, commission and other expenses"
          : "COMPLETED bookings · recorded amounts",
    };
  if (id === "rent")
    return {
      value: money(d.rent.estimated),
      detail: "Configured percentage and weekly cap · estimate",
    };
  if (id === "fullRent")
    return {
      value:
        d.rent.fullRentDrivers === null
          ? "Data required"
          : number(d.rent.fullRentDrivers),
      detail: "Estimated cap reached in at least one selected week",
    };
  if (id === "companyIncome")
    return {
      value: "Rent receipts required",
      detail:
        "Recorded margin " +
        money(d.totals.margin) +
        "; actual rent is not recorded here",
    };
  return {
    value: number(Number(d.totals[id as keyof Totals])),
    detail:
      id === "recovered"
        ? "Distinct bookings with a processed recovered webhook"
        : "Bookings in the selected pickup period",
  };
}
export default function AnalyticsDashboard({
  userId,
  showDrivers,
}: {
  userId: string;
  showDrivers: boolean;
}) {
  const [preset, setPreset] = useState<Preset>("today"),
    [payment, setPayment] = useState<Payment>("ALL"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [cards, setCards] = useState<CardId[]>([...defaultCards]),
    [customize, setCustomize] = useState(false),
    [ready, setReady] = useState(false),
    [data, setData] = useState<AnalyticsData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [tick, setTick] = useState(0);
  const seq = useRef(0);
  const storage = "taxicrm-analytics-v1:" + userId;
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const validPreset = presets.find((v) => v.id === p.get("preset"));
    if (validPreset) setPreset(validPreset.id);
    if (["ALL", "CASH", "ACCOUNT", "CARD"].includes(p.get("payment") || ""))
      setPayment(p.get("payment") as Payment);
    setFrom(p.get("from") || "");
    setTo(p.get("to") || "");
    try {
      const saved = JSON.parse(localStorage.getItem(storage) || "null");
      if (saved?.version === 1 && Array.isArray(saved.cards))
        setCards(cleanCards(saved.cards));
    } catch {
      /* Keep defaults if browser storage is unavailable. */
    }
    setReady(true);
  }, [storage]);
  useEffect(() => {
    if (!ready) return;
    const id = ++seq.current,
      controller = new AbortController();
    setError("");
    setData(null);
    if (preset === "custom" && (!from || !to)) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const p = new URLSearchParams({ preset, payment });
    if (preset === "custom") {
      p.set("from", from);
      p.set("to", to);
    }
    window.history.replaceState(null, "", "?" + p.toString());
    fetch("/api/dashboard/analytics?" + p, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error || "Report unavailable.");
        return body;
      })
      .then((d) => {
        if (id === seq.current) setData(d);
      })
      .catch((e) => {
        if (id === seq.current && e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (id === seq.current) setBusy(false);
      });
    return () => controller.abort();
  }, [preset, payment, from, to, tick, ready]);
  function choose(next: CardId[]) {
    setCards(next);
    try {
      localStorage.setItem(
        storage,
        JSON.stringify({ version: 1, cards: next }),
      );
    } catch {
      setError(
        "Cards changed for this session; browser storage is unavailable.",
      );
    }
  }
  const ranked = data
    ? [...data.areas]
        .filter((a) => a.key !== "UNKNOWN")
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
    : [];
  return (
    <div className="mx-auto max-w-[1700px] space-y-6 p-4 sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.25em] text-brand">
            Performance / business analytics
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-app-primary sm:text-4xl">
            Your business, in focus.
          </h1>
          <p className="mt-2 text-sm text-app-muted">
            Bookings, money and demand — one clear view of the selected period.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl border border-app-border bg-surface px-4 py-2 text-sm"
            onClick={() => setCustomize(!customize)}
            aria-expanded={customize}
          >
            Customize cards
          </button>
          <button
            type="button"
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy || !ready}
            onClick={() => setTick((n) => n + 1)}
          >
            Refresh
          </button>
        </div>
      </header>
      <section
        aria-label="Analysis filters"
        className="rounded-2xl border border-app-border bg-surface p-4"
      >
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-lg border px-3 py-2 text-sm ${preset === p.id ? "border-brand bg-brand/10 font-semibold text-brand" : "border-app-border text-app-muted"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          {preset === "custom" && (
            <>
              <label className="text-xs text-app-muted">
                From
                <input
                  aria-label="From date"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 block rounded-lg border border-app-border bg-surface-subtle px-3 py-2 text-sm text-app-primary"
                />
              </label>
              <label className="text-xs text-app-muted">
                To, inclusive
                <input
                  aria-label="To date"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 block rounded-lg border border-app-border bg-surface-subtle px-3 py-2 text-sm text-app-primary"
                />
              </label>
            </>
          )}
          <label className="text-xs text-app-muted">
            Payment
            <select
              aria-label="Payment filter"
              value={payment}
              onChange={(e) => setPayment(e.target.value as Payment)}
              className="mt-1 block rounded-lg border border-app-border bg-surface-subtle px-3 py-2 text-sm text-app-primary"
            >
              <option value="ALL">All payments</option>
              <option value="CASH">Cash</option>
              <option value="ACCOUNT">Account</option>
              <option value="CARD">Card</option>
            </select>
          </label>
          <p className="pb-2 text-xs text-app-muted">
            Europe/London · pickup time · Today / This week run up to now
          </p>
        </div>
      </section>
      {customize && (
        <section
          aria-label="Choose cards"
          className="rounded-2xl border border-app-border bg-surface p-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Make this view yours</h2>
            <button
              className="text-sm text-brand"
              onClick={() => choose([...defaultCards])}
            >
              Reset cards
            </button>
          </div>
          <p className="mt-1 text-xs text-app-muted">
            Saved for your account in this browser. Uncheck a card to hide it.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(cardLabels).map(([id, label]) => (
              <label key={id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cards.includes(id as CardId)}
                  onChange={(e) =>
                    choose(
                      e.target.checked
                        ? [...cards, id as CardId]
                        : cards.filter((c) => c !== id),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-5 space-y-2 border-t border-app-border pt-4">
            {cards.map((id, i) => (
              <div
                key={id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span>
                  {i + 1}. {cardLabels[id]}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={i === 0}
                    aria-label={"Move " + cardLabels[id] + " up"}
                    className="rounded border border-app-border px-2 py-1 disabled:opacity-30"
                    onClick={() => {
                      const next = [...cards];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      choose(next);
                    }}
                  >
                    ↑
                  </button>
                  <button
                    disabled={i === cards.length - 1}
                    aria-label={"Move " + cardLabels[id] + " down"}
                    className="rounded border border-app-border px-2 py-1 disabled:opacity-30"
                    onClick={() => {
                      const next = [...cards];
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      choose(next);
                    }}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm"
        >
          {error}
        </div>
      )}
      {busy && (
        <div role="status" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-app-border bg-surface"
            />
          ))}
          <span className="sr-only">Loading analysis…</span>
        </div>
      )}
      {!busy && !data && !error && (
        <p className="rounded-xl border border-app-border p-5 text-sm text-app-muted">
          Choose both custom dates to load your analysis.
        </p>
      )}
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-app-muted">
            <span>
              {new Date(data.range.from).toLocaleString("en-GB", {
                timeZone: "Europe/London",
              })}{" "}
              —{" "}
              {new Date(data.range.to).toLocaleString("en-GB", {
                timeZone: "Europe/London",
              })}{" "}
              (end exclusive)
            </span>
            <span>
              Updated{" "}
              {new Date(data.generatedAt).toLocaleTimeString("en-GB", {
                timeZone: "Europe/London",
              })}
            </span>
          </div>
          <ExecutiveOverview data={data} />
          {data.totals.total === 0 && (
            <p
              role="status"
              className="rounded-xl border border-app-border bg-surface p-5"
            >
              No bookings match this selection.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((id) => {
              const c = cardValue(id, data);
              return (
                <article
                  key={id}
                  aria-label={cardLabels[id]}
                  className="rounded-2xl border border-app-border bg-surface p-5"
                >
                  <p className="text-xs font-medium text-app-muted">
                    {cardLabels[id]}
                  </p>
                  <p
                    className={`mt-3 break-words text-2xl font-semibold tracking-tight ${id === "margin" && data.totals.margin !== null && data.totals.margin < 0 ? "text-orange-400" : "text-app-primary"}`}
                  >
                    {c.value}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-app-muted">
                    {c.detail}
                  </p>
                </article>
              );
            })}
          </div>
          {!cards.length && (
            <p className="text-sm text-app-muted">
              All cards are hidden. Use Customize cards to add them back.
            </p>
          )}
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Busiest time of day"
              sub="Pickup bookings by London hour; repeated DST hours are combined."
            >
              <BarChart
                rows={data.hours.map((r) => ({
                  label: String(r.hour).padStart(2, "0"),
                  count: r.count,
                }))}
                label="Bookings by hour of day"
              />
            </Panel>
            <Panel
              title="Daily demand"
              sub="Recorded pickups by date in the selected period."
            >
              <BarChart
                rows={data.days.map((r) => ({
                  label: r.date.slice(5),
                  count: r.count,
                }))}
                label="Bookings by date"
                color="bg-cyan-500"
              />
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Busiest day of the week"
              sub="Available when at least seven London calendar dates are selected."
            >
              {data.range.calendarDays >= 7 ? (
                <BarChart
                  rows={data.weekdays.map((r) => ({
                    label: weekdays[r.day - 1],
                    count: r.count,
                  }))}
                  label="Bookings by weekday"
                />
              ) : (
                <p className="flex h-48 items-center justify-center text-sm text-app-muted">
                  Select at least 7 days to compare weekdays.
                </p>
              )}
            </Panel>
            <Panel
              title="Outcomes & payment mix"
              sub="Current status in this pickup cohort. Recovered is a webhook history signal, not a separate final status."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-3">
                  {(
                    ["completed", "cancelled", "noFare", "rejected"] as const
                  ).map((k) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-app-muted">
                        {k === "noFare"
                          ? "No fare"
                          : k[0].toUpperCase() + k.slice(1)}
                      </span>
                      <strong>{number(data.totals[k])}</strong>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {(["cash", "account", "card", "other"] as const).map((k) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-app-muted">
                        {k === "other"
                          ? "Other / unknown"
                          : k[0].toUpperCase() + k.slice(1)}
                      </span>
                      <strong>{number(data.totals[k])}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
          <Panel
            title="Income & driver money over time"
            sub="Known monetary subtotals on COMPLETED jobs, by London pickup date. Missing amounts remain incomplete; this is not profit."
          >
            <MoneyTrend rows={data.revenueTrend} />
          </Panel>
          <Panel
            title="Demand heat map"
            sub="Aggregated pickup-zone activity. Unknown or unmapped zones remain in the totals, not on the map."
          >
            <AreaMap areas={data.areas} />
          </Panel>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel
              title="Busy areas"
              sub="Top verified pickup zones, ranked by booking count."
            >
              <div className="space-y-3">
                {ranked.length ? (
                  ranked.map((a) => (
                    <div key={a.key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{a.name}</span>
                        <strong>{number(a.total)}</strong>
                      </div>
                      <div className="h-1.5 rounded bg-surface-subtle">
                        <div
                          className="h-1.5 rounded bg-brand"
                          style={{
                            width: `${(a.total / Math.max(1, ranked[0].total)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-app-muted">
                    No verified pickup-zone associations in this selection.
                  </p>
                )}
              </div>
            </Panel>
            <Panel
              title="Recorded money"
              sub="Gross income is Price; driver money is Cost. Only COMPLETED bookings contribute."
            >
              <dl className="space-y-3 text-sm">
                {[
                  ["Cash", data.totals.cashIncome],
                  ["Account", data.totals.accountIncome],
                  ["Card", data.totals.cardIncome],
                  ["Other / unknown", data.totals.otherIncome],
                  ["Total income / revenue", data.totals.gross],
                  ["Driver revenue", data.totals.driverMoney],
                  ["Company margin before other expenses", data.totals.margin],
                  ["Estimated driver rent", data.rent.estimated],
                ].map(([label, value]) => (
                  <div
                    className="flex justify-between gap-4"
                    key={String(label)}
                  >
                    <dt className="text-app-muted">{label}</dt>
                    <dd className="font-semibold tabular-nums">
                      {money(value as number | null)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-5 text-app-muted">
                Rent is an estimate using the saved percentage (
                {data.rent.rate === null
                  ? "not configured"
                  : data.rent.rate + "%"}
                ) and weekly cap ({money(data.rent.cap)}), applied to selected
                driver earnings by London week. Partial periods or payment
                filters give a partial estimate. Actual rent receipts and other
                expenses are needed for company income and net profit.
              </p>
            </Panel>
          </div>
          {showDrivers && (
            <Panel
              title="Driver outcome rankings"
              sub="Rejected/recovered rankings require the driver explicitly identified in the event. No fare uses the saved assigned driver. This does not establish fault."
            >
              <div className="grid gap-6 md:grid-cols-3">
                {(["rejected", "noFare", "recovered"] as const).map((kind) => (
                  <div key={kind}>
                    <h3 className="mb-3 text-sm font-semibold">
                      Most {kind === "noFare" ? "no fare" : kind}
                    </h3>
                    {data.drivers[kind].length ? (
                      <ol className="space-y-2">
                        {data.drivers[kind].map((r, i) => (
                          <li
                            key={r.label + ":" + i}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-app-muted">{r.label}</span>
                            <strong>{number(r.count)}</strong>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-app-muted">
                        No attributed evidence.
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-app-muted">
                Unattributed outcome records:{" "}
                {number(data.drivers.unattributed)}. No driver is guessed from a
                later assignment.
              </p>
            </Panel>
          )}
          <details className="rounded-2xl border border-app-border bg-surface p-5">
            <summary className="cursor-pointer text-sm font-semibold">Data quality & definitions</summary>
            <div className="mt-4 space-y-4">
              <DataCoverage data={data} />
          <Panel title="Coverage & definitions">
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <strong>{number(data.totals.unknownArea)}</strong>
                <p className="text-xs text-app-muted">
                  Bookings without a verified pickup zone
                </p>
              </div>
              <div>
                <strong>
                  {number(data.totals.missingPrice)} /{" "}
                  {number(data.totals.missingCost)}
                </strong>
                <p className="text-xs text-app-muted">
                  Completed jobs missing Price / Cost
                </p>
              </div>
              <div>
                <strong>{number(data.totals.prebook)}</strong>
                <p className="text-xs text-app-muted">
                  Pre-booked at least 6 hours ahead, matching the existing CRM
                  rule
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-app-muted">
              Filters select pickup time, with an exclusive end. Bookings
              without that timestamp are excluded. All payments includes
              unclassified payment types. Source NULL is unknown, zero is
              recorded zero; missing amounts are excluded from known-income
              subtotals and make margin unavailable. Negative margins and
              loyalty discounts are preserved. Area winners exclude unknown
              zones; profitability compares areas with complete monetary
              records. This is recorded activity, not a forecast or net profit.
            </p>
          </Panel>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
