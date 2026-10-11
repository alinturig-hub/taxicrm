"use client";

import { useState } from "react";
import { previewFreephoneWorkflow, type FreephoneRule } from "@/lib/notifications/freephone-workflow-preview";

const labels = {DAILY_REPORT: "Daily booking report", NO_BOOKINGS: "No bookings in 24h", BELOW_THRESHOLD: "Bookings below threshold"};
export default function FreephoneWorkflowPreview() {
  const [name, setName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [count, setCount] = useState("");
  const [rules, setRules] = useState<FreephoneRule[]>([
    {event: "DAILY_REPORT", enabled: true, recipient: "", text: "{freephone}: {count} bookings in the last {period}."},
    {event: "NO_BOOKINGS", enabled: true, recipient: "", text: "{freephone}: no bookings in the last {period}."},
    {event: "BELOW_THRESHOLD", enabled: true, recipient: "", text: "{freephone}: {count} bookings, below the threshold of {threshold}."},
  ]);
  const [preview, setPreview] = useState<ReturnType<typeof previewFreephoneWorkflow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  function clear() {setPreview(null); setError(null);}
  function update(index: number, change: Partial<FreephoneRule>) {setRules(current => current.map((rule, offset) => offset === index ? {...rule, ...change} : rule)); clear();}
  const inputClass = "w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-slate-200";
  return <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <div><h2 className="text-xl font-semibold text-white">Freephone notifications</h2><p className="mt-1 text-sm text-slate-400">Freephone name → rolling 24h booking check → event SMS. Preview only; not scheduled or saved.</p></div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1 text-sm text-slate-300">Freephone name<input placeholder="e.g. Derriford Hospital Freephone" value={name} onChange={event => {setName(event.target.value); clear();}} className={inputClass} /></label>
      <label className="space-y-1 text-sm text-slate-300">General SMS recipient<input placeholder="International number starting with +" value={recipient} onChange={event => {setRecipient(event.target.value); clear();}} className={inputClass} /></label>
    </div>
    <div className="divide-y divide-slate-800 rounded-xl border border-slate-800">
      {rules.map((rule, index) => <details key={rule.event} className="p-3">
        <summary className="cursor-pointer text-sm text-slate-200">{labels[rule.event]} · {rule.enabled ? "Enabled in draft" : "Disabled in draft"} · {rule.recipient.trim() ? "Specific recipient" : "General recipient"}</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-300"><input type="checkbox" checked={rule.enabled} onChange={event => update(index, {enabled: event.target.checked})} className="mr-2" />Include this event</label>
          {rule.event === "BELOW_THRESHOLD" ? <label className="text-sm text-slate-300">Minimum booking count<input type="number" min="1" step="1" value={rule.threshold ?? ""} onChange={event => update(index, {threshold: event.target.value === "" ? undefined : Number(event.target.value)})} className={inputClass} /></label> : null}
          <label className="text-sm text-slate-300 md:col-span-2">Event SMS text<textarea value={rule.text} onChange={event => update(index, {text: event.target.value})} rows={2} className={inputClass} /></label>
          <label className="text-sm text-slate-300 md:col-span-2">Specific recipient (blank uses general)<input value={rule.recipient} onChange={event => update(index, {recipient: event.target.value})} className={inputClass} /></label>
        </div>
      </details>)}
    </div>
    <p className="text-xs text-slate-400">Message fields: {"{freephone}, {count}, {period}, {threshold}"}. Each matching rule produces its own preview message.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm text-slate-300">Synthetic booking count for preview<input type="number" min="0" step="1" value={count} onChange={event => {setCount(event.target.value); clear();}} className={inputClass} /></label>
      <button type="button" onClick={() => {try {if (!count.trim()) throw new Error("Enter a synthetic booking count."); setPreview(previewFreephoneWorkflow({name, defaultRecipient: recipient, rules}, Number(count))); setError(null);} catch (error) {setPreview(null); setError(error instanceof Error ? error.message : "Invalid workflow.");}}} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Preview events</button>
    </div>
    {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
    {preview ? <div className="space-y-2">{preview.map(event => <div key={event.event} className="rounded-lg border border-slate-700 p-3 text-sm text-slate-300"><p className="font-semibold">{labels[event.event]}: {event.triggered ? "Would trigger" : "Would not trigger"}</p><p>To: {event.recipient}</p><p>{event.text}</p></div>)}</div> : null}
  </section>;
}
