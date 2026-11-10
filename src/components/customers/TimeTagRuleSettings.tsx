"use client";
import { useEffect, useState } from "react";
import { parseTimeTagRules, type SavedTimeTagRule } from "@/lib/customers/time-tag-rules";
export default function TimeTagRuleSettings() {
    const [rules, setRules] = useState<SavedTimeTagRule[]>([]), [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
    async function load() { setLoading(true); setError(""); try {
        const r = await fetch("/api/dashboard/customers/time-tag-rules", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error || "Could not load rules");
        setRules(parseTimeTagRules(d.rules));
        setRevision(d.revision);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Could not load rules");
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { void load(); }, []);
    function update(id: string, key: keyof SavedTimeTagRule, value: string | number | boolean) { setRules(current => current.map(r => r.id === id ? { ...r, [key]: value } : r)); setNotice(""); }
    async function save() { setError(""); setNotice(""); let valid; try {
        valid = parseTimeTagRules(rules);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Invalid rules");
        return;
    } setSaving(true); try {
        const r = await fetch("/api/dashboard/customers/time-tag-rules", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision, rules: valid }) });
        const d = await r.json();
        if (!r.ok)
            throw Error(d.error || "Could not save rules");
        setRevision(d.revision);
        setRules(parseTimeTagRules(d.rules));
        setNotice("Rules saved. Reopened profiles use these rules immediately. Cached audience tags update during normal tag processing; saving does not start a bulk run.");
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Could not save rules");
    }
    finally {
        setSaving(false);
    } }
    const field = "mt-1 block w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-app-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";
    return <main className="space-y-6 text-app-primary"><header><p className="text-sm text-app-muted">Customers / Behaviour tags</p><h1 className="mt-2 text-3xl font-semibold">Time tag rules</h1><p className="mt-3 max-w-3xl text-app-muted">Choose the London time window and evidence needed for each tag. Only completed journeys with recorded pickup times count. Night windows can cross midnight. Tags describe recorded activity; they do not determine marketing permission.</p></header>{error && <p role="alert" className="rounded-xl border border-red-500 p-4">{error}</p>}{notice && <p role="status" className="rounded-xl border border-brand p-4">{notice}</p>}{loading ? <p role="status">Loading rules…</p> : <><div className="flex flex-wrap gap-3"><button disabled={saving || rules.length >= 20} onClick={() => setRules(r => [...r, { id: "CUSTOM_TIME_" + crypto.randomUUID().replaceAll("-", "").toUpperCase(), name: "New time tag", start: "08:00", end: "12:00", windowDays: 14, minimumMatches: 3, minimumPercent: 40, enabled: false }])} className="rounded-lg border border-app-border px-4 py-2">Add time rule</button><button disabled={saving} onClick={() => void load()} className="rounded-lg border border-app-border px-4 py-2">Reload saved rules</button></div>{!rules.length && <p>No time rules. Add a rule to begin.</p>}<fieldset disabled={saving} className="space-y-4">{rules.map(rule => <section key={rule.id} aria-label={rule.name} className="rounded-xl border border-app-border bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex gap-2"><input type="checkbox" checked={rule.enabled} onChange={e => update(rule.id, "enabled", e.target.checked)}/>Enabled</label><button type="button" onClick={() => setRules(r => r.filter(x => x.id !== rule.id))} className="rounded-lg border border-app-border px-3 py-2">Remove rule</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label>Name<input className={field} value={rule.name} maxLength={60} onChange={e => update(rule.id, "name", e.target.value)}/></label><label>Start time, London<input className={field} type="time" value={rule.start} onChange={e => update(rule.id, "start", e.target.value)}/></label><label>End time, London<input className={field} type="time" value={rule.end} onChange={e => update(rule.id, "end", e.target.value)}/></label>{([["windowDays", "Lookback days", 1, 90], ["minimumMatches", "Minimum matching journeys", 1, 1000], ["minimumPercent", "Minimum share (%)", 0, 100]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input className={field} type="number" min={min} max={max} value={Number.isFinite(rule[key]) ? rule[key] : ""} onChange={e => update(rule.id, key, e.target.value === "" ? NaN : Number(e.target.value))}/></label>)}</div></section>)}</fieldset><button disabled={saving} onClick={() => void save()} className="rounded-lg bg-brand px-5 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save rules"}</button><p className="text-sm text-app-muted">Changes are shared across this company users. Unsaved changes stay in this page. Removing a rule takes effect when you save. Weekend and place tags are unaffected.</p></>}</main>;
}
