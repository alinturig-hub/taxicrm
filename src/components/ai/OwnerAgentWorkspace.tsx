"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import BusinessReview from "./BusinessReview";
import OwnerAgentProviderSettings from "./OwnerAgentProviderSettings";
import type { AgentAnswer } from "@/lib/ai/owner-agent/evidence";
import { defaultPreferences, priorities, type Preferences } from "@/lib/ai/owner-agent/policy";
type Setup = { company: string; agentId: string; modelConfigured: boolean; canManageMemory: boolean; canManageProvider: boolean; canAnalyse: boolean; memory: { revision: number; preferences: Preferences; persistent: boolean } };
type Message = { id: number; question: string; answer?: AgentAnswer; message?: string; method?: string };
const errors: Record<string, string> = {
  AGENT_NOT_ENABLED: "Your company agent has not been activated yet",
  COMPANY_ISOLATION_NOT_CONFIGURED: "Your company connection needs administrator setup",
  READ_ONLY_DATABASE_BINDING_REQUIRED: "A separate read-only company connection is required",
  AGENT_ROLE_MUST_BE_READ_ONLY: "The agent connection needs an access review before reports can run",
  AGENT_BUSY_RETRY: "The agent is busy. Please wait a few seconds and try again",
  AGENT_RANGE_LIMIT_31_DAYS: "Choose a period of at most 31 London calendar days",
  BOOKING_REPORT_REVENUE_ACCESS_REQUIRED: "Booking, reporting and revenue permissions are required",
  MEMORY_REVISION_CONFLICT: "Company preferences changed. Reload the page before confirming",
  MEMORY_BUSY_RETRY: "Another preference change is being saved. Please try again",
  DURABLE_MEMORY_NOT_CONFIGURED: "Saved preferences have not been enabled by your administrator",
};
const errorMessage = (code: unknown) => typeof code === "string" ? errors[code] || "The agent could not complete this request" : "The agent is unavailable";
const labels = { BALANCED: "Balanced overview", INCREASE_MARGIN: "Improve company margin", REDUCE_NO_FARE: "Review no-fare outcomes", IMPROVE_COMPLETION: "Improve completion" };
const format = (value: number | null, unit: string) => value === null ? "Unknown" : unit === "GBP" ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value) : value.toLocaleString("en-GB");
const when = (s: string) => new Date(s).toLocaleString("en-GB", { timeZone: "Europe/London" });
export default function OwnerAgentWorkspace() {
  const [setup, setSetup] = useState<Setup | null>(null), [error, setError] = useState(""), [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]), [busy, setBusy] = useState(false), [preferences, setPreferences] = useState<Preferences>({ ...defaultPreferences });
  const [review, setReview] = useState(false), [saving, setSaving] = useState(false), [notice, setNotice] = useState("");
  const [preset, setPreset] = useState("today"), [payment, setPayment] = useState("ALL"), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const mounted = useRef(true), locked = useRef(false);
  const inputClass = "mt-1 w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-app-primary";
  useEffect(() => {
    mounted.current = true; const abort = new AbortController();
    fetch("/api/dashboard/ai/owner-agent", { cache: "no-store", signal: abort.signal }).then(async r => {
      const body = await r.json(); if (!r.ok) throw Error(errorMessage(body.error));
      if (mounted.current) { setSetup(body); setPreferences(body.memory.preferences); }
    }).catch(e => { if (mounted.current && e.name !== "AbortError") setError(e.message); });
    return () => { mounted.current = false; abort.abort(); };
  }, []);
  async function ask(value: string) {
    if (!value.trim() || !setup || !setup.canAnalyse || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    const id = Date.now(); setMessages(m => [...m.slice(-19), { id, question: value.trim() }]); setQuestion("");
    try {
      const r = await fetch("/api/dashboard/ai/owner-agent", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(80000), body: JSON.stringify({ question: value.trim(), preset, payment, ...(preset === "custom" ? { from, to } : {}) }) });
      const body = await r.json(); if (!r.ok) throw Error(errorMessage(body.error));
      if (mounted.current) setMessages(m => m.map(x => x.id === id ? { ...x, answer: body.answer, message: body.message, method: body.safeguards?.method } : x));
    } catch (e) { if (mounted.current) setMessages(m => m.map(x => x.id === id ? { ...x, message: e instanceof Error ? e.message : "Agent unavailable" } : x)); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  async function refreshProviderStatus() {
    try {
      const r = await fetch("/api/dashboard/ai/owner-agent", { cache: "no-store" });
      if (r.ok) { const result = await r.json(); if (mounted.current) setSetup(result); }
    } catch { /* Keep current company context; do not substitute a provider. */ }
  }
  async function confirm() {
    if (!setup || saving) return; setSaving(true); setError("");
    try {
      const r = await fetch("/api/dashboard/ai/owner-agent", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ preferences, expectedRevision: setup.memory.revision, confirm: true }) });
      const body = await r.json(); if (!r.ok) throw Error(errorMessage(body.error));
      if (mounted.current) { setSetup({ ...setup, memory: body }); setReview(false); setNotice(`Confirmed company preference · revision ${body.revision}. Financial and KPI rules are unchanged.`); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Memory unavailable"); }
    finally { if (mounted.current) setSaving(false); }
  }
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-7">
    <header><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">NXT / TaxiCRM owner agent</p><h1 className="mt-2 text-3xl font-semibold">Your company. Your evidence.</h1><p className="mt-2 text-sm text-app-muted">A dedicated business assistant with confirmed preferences and recorded company facts.</p></header>
    {error && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">{error}. Setup and permissions are managed by your TaxiCRM administrator. Existing Copilot remains available.</p>}
    {!setup ? <p className="text-sm text-app-muted">{error ? "Company isolation, a dedicated read-only database role and agent configuration are required before this agent can run." : "Checking company agent configuration…"}</p> : <>
      <section className="rounded-2xl border border-app-border bg-surface p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{setup.company}</h2><p className="mt-1 text-xs text-app-muted">{setup.agentId} · read-only business tools</p></div><span className="text-xs text-brand">{setup.modelConfigured ? "AI connection configured · verified business figures" : "Business reports ready · AI model not connected"}</span></div><p className="mt-3 text-xs leading-5 text-app-muted">The configured model may receive your question to select a permitted analysis. Booking records and identities are not sent to it. Figures come from CRM calculations. Chat is held only in this tab; no conversation training or autonomous writes.</p></section>
      {setup.canManageProvider && <OwnerAgentProviderSettings onSaved={refreshProviderStatus} />}
      <section className="rounded-2xl border border-app-border bg-surface p-5"><h2 className="font-semibold">Business objective</h2><p className="mt-1 text-xs text-app-muted">Choose the outcome you want to improve. The agent uses it to order evidence and proposed decisions; it does not execute them.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs text-app-muted">Business objective<select aria-label="Business priority" className={inputClass} value={preferences.priority} disabled={!setup.canManageMemory} onChange={e => { setReview(false); setPreferences({ ...preferences, priority: e.target.value as Preferences["priority"] }); }}>{priorities.map(v => <option key={v} value={v}>{labels[v]}</option>)}</select></label><label className="text-xs text-app-muted">Report detail<select aria-label="Report detail" className={inputClass} value={preferences.style} disabled={!setup.canManageMemory} onChange={e => { setReview(false); setPreferences({ ...preferences, style: e.target.value as Preferences["style"] }); }}><option value="BRIEF">Brief</option><option value="DETAILED">Detailed evidence</option></select></label></div><p className="mt-3 text-xs text-app-muted">Saved priority: {labels[setup.memory.preferences.priority]} · revision {setup.memory.revision}. {setup.memory.persistent ? "Confirmed preferences are saved for this company." : "Saved preferences have not been enabled yet."}</p>{setup.canManageMemory && <button className="mt-3 rounded-lg border border-app-border px-3 py-2 text-sm disabled:opacity-40" disabled={!setup.memory.persistent || saving} onClick={() => setReview(true)}>Review objective</button>}{review && <div className="mt-4 rounded-xl border border-brand/30 p-4"><p className="text-sm">Proposed: {labels[preferences.priority]} · {preferences.style.toLowerCase()} reports. This changes presentation context only.</p><button onClick={confirm} disabled={saving} className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Confirm objective</button></div>}{notice && <p role="status" className="mt-3 text-sm text-brand">{notice}</p>}</section>
      <section className="rounded-2xl border border-app-border bg-surface p-5"><h2 className="font-semibold">Ask about your business</h2>{!setup.canAnalyse && <p className="mt-2 text-sm text-app-muted">Booking, reporting and revenue permissions are required to run these analyses. Ask your administrator to review access.</p>}<p className="mt-1 text-xs text-app-muted">The controls below define every answer. Dates written in chat do not override them. Maximum 31 London calendar days.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-app-muted">Pickup period<select aria-label="Agent pickup period" className={inputClass} value={preset} onChange={e => setPreset(e.target.value)}><option value="today">Today</option><option value="this-week">This week</option><option value="last-hour">Last hour</option><option value="last-6-hours">Last 6 hours</option><option value="last-12-hours">Last 12 hours</option><option value="custom">Custom dates</option></select></label><label className="text-xs text-app-muted">Payment<select aria-label="Agent payment" className={inputClass} value={payment} onChange={e => setPayment(e.target.value)}><option value="ALL">All payments</option><option value="CASH">Cash</option><option value="ACCOUNT">Account</option><option value="CARD">Card</option></select></label>{preset === "custom" && <><label>From<input aria-label="Agent from date" type="date" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} /></label><label>To, inclusive<input aria-label="Agent to date" type="date" className={inputClass} value={to} onChange={e => setTo(e.target.value)} /></label></>}</div><div className="mt-4 flex flex-wrap gap-2">{["Give me a business overview", "Explain company margin", "Which areas need review?"].map(q => <button key={q} disabled={busy || !setup.canAnalyse} onClick={() => ask(q)} className="rounded-lg border border-app-border px-3 py-2 text-xs disabled:opacity-40">{q}</button>)}</div><form className="mt-4 flex gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); ask(question); }}><input aria-label="Ask owner agent" placeholder="Ask about demand, margins or booking outcomes" maxLength={1000} className={inputClass} value={question} onChange={e => setQuestion(e.target.value)} /><button disabled={busy || !setup.canAnalyse || !question.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Ask</button></form></section>
      <div aria-live="polite" className="space-y-5">{messages.map(m => <article key={m.id} className="rounded-2xl border border-app-border bg-surface p-5"><p className="text-sm font-medium text-brand">{m.question}</p>{m.message && <p className="mt-3 text-sm">{m.message}</p>}{m.answer && <><h2 className="mt-3 text-lg font-semibold">{m.answer.headline}</h2><p className="mt-2 text-sm text-app-muted">{m.answer.summary}</p><p className="mt-2 text-xs text-app-muted">Pickup: {when(m.answer.range.from)} — {when(m.answer.range.to)} (end exclusive), Europe/London · {m.answer.range.payment}. Generated {when(m.answer.generatedAt)}.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{m.answer.metrics.map(metric => <div key={metric.label} className="rounded-xl border border-app-border p-4"><h3 className="text-xs text-app-muted">{metric.label}</h3><p className="mt-2 text-xl font-semibold">{format(metric.value, metric.unit)}</p><p className="mt-1 text-xs text-app-muted">{metric.coverage}</p></div>)}</div>{m.answer.businessReview && <BusinessReview review={m.answer.businessReview} />}{m.answer.areas.map((a, i) => <p key={i} className="mt-3 text-sm">{a.label}: {a.name} · {a.bookings} bookings{a.margin === null ? "" : ` · ${format(a.margin, "GBP")}`}</p>)}<details className="mt-4 text-xs text-app-muted"><summary className="cursor-pointer">Evidence and limits</summary><p className="mt-2">Evidence {m.answer.evidenceId} · {m.answer.knowledgeVersion} · {m.method}</p><ul className="mt-2 space-y-2">{[...m.answer.rules, ...m.answer.limitations].map(rule => <li key={rule}>{rule}</li>)}</ul></details>{m.answer.sources.map(source => <a key={source.href} href={source.href} className="mt-3 inline-block text-sm text-brand">{source.label} →</a>)}</>}</article>)}{busy && <p role="status" className="text-sm text-app-muted">Calculating a bounded company report…</p>}</div>
    </>}
  </div>;
}
