"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cards, focuses, periods, presets, parseConfig, type WorkspaceCard, type WorkspaceConfig } from "@/lib/workspace/home/config";
import type { WorkspaceSummary } from "@/lib/workspace/home/summary";
const focusLabels = { OWNER: "Business owner", MARKETING: "Marketing", OPERATIONS: "Operations", TECHNICAL: "Technical administration" };
const periodLabels = { TODAY: "Today", YESTERDAY: "Yesterday", LAST7: "Last 7 days", LAST30: "Last 30 days" };
type Shortcut = {
    label: string;
    href: string;
    technical: boolean;
};
const button = "min-h-11 rounded-lg border border-app-border bg-surface px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40";
function format(value: number, id: WorkspaceCard) { return cards[id].unit === "GBP" ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(value) : value.toLocaleString("en-GB"); }
export default function MyWorkspace({ userId, name, allowed, initial, initialSummary, shortcuts, canUseAI }: {
    userId: string;
    name: string;
    allowed: WorkspaceCard[];
    initial: {
        revision: number;
        config: WorkspaceConfig;
    };
    initialSummary: WorkspaceSummary;
    shortcuts: Shortcut[];
    canUseAI: boolean;
}) {
    const [config, setConfig] = useState(initial.config), [revision, setRevision] = useState(initial.revision), [summary, setSummary] = useState(initialSummary);
    const [draft, setDraft] = useState(initial.config), [editing, setEditing] = useState(false), [saving, setSaving] = useState(false), [loading, setLoading] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState(""), [legacy, setLegacy] = useState<WorkspaceCard[] | null>(null);
    const request = useRef<AbortController | null>(null), customize = useRef<HTMLButtonElement>(null), editHeading = useRef<HTMLHeadingElement>(null);
    useEffect(() => { try {
        const old = JSON.parse(localStorage.getItem(`taxicrm-today-v1:${userId}`) || "null");
        if (initial.revision === 0 && old?.version === 1 && Array.isArray(old.widgets)) {
            const ids = old.widgets.filter((id: unknown): id is WorkspaceCard => typeof id === "string" && allowed.includes(id as WorkspaceCard));
            if (ids.length)
                setLegacy(Array.from(new Set(ids)));
        }
    }
    catch { /* Import is optional; account storage is authoritative. */ } return () => request.current?.abort(); }, [userId, initial.revision, allowed]);
    useEffect(() => { if (editing)
        editHeading.current?.focus(); }, [editing]);
    async function refresh(period = config.period) { request.current?.abort(); const abort = new AbortController(); request.current = abort; setLoading(true); setError(""); try {
        const response = await fetch(`/api/dashboard/workspace/summary?period=${period}`, { cache: "no-store", signal: abort.signal });
        const data = await response.json();
        if (!response.ok)
            throw Error(data.error || "Could not load figures");
        if (!abort.signal.aborted) {
            setSummary(data);
            setNotice("Figures updated.");
        }
    }
    catch (e) {
        if (!abort.signal.aborted)
            setError(e instanceof Error ? e.message : "Could not load figures");
    }
    finally {
        if (!abort.signal.aborted)
            setLoading(false);
    } }
    async function save(next: WorkspaceConfig) { setSaving(true); setError(""); setNotice(""); try {
        const valid = parseConfig(next, allowed);
        const response = await fetch("/api/dashboard/workspace/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ revision, config: valid }) });
        const data = await response.json();
        if (!response.ok)
            throw Error(data.error || "Could not save layout");
        setConfig(data.config);
        setRevision(data.revision);
        setDraft(data.config);
        setEditing(false);
        setLegacy(null);
        setNotice("Layout saved to your account, including other devices.");
        customize.current?.focus();
        await refresh(data.config.period);
        setNotice("Layout saved to your account, including other devices.");
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Could not save layout");
    }
    finally {
        setSaving(false);
    } }
    async function reload() { setError(""); setSaving(true); try {
        const response = await fetch("/api/dashboard/workspace/preferences", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok)
            throw Error(data.error || "Could not load saved layout");
        const valid = parseConfig(data.config, allowed);
        setConfig(valid);
        setDraft(valid);
        setRevision(data.revision);
        setEditing(false);
        await refresh(valid.period);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Could not load saved layout");
    }
    finally {
        setSaving(false);
    } }
    function move(index: number, offset: number) { setDraft(current => { const widgets = [...current.widgets]; [widgets[index], widgets[index + offset]] = [widgets[index + offset], widgets[index]]; return { ...current, widgets }; }); }
    const preferred: Record<WorkspaceConfig["focus"], string[]> = { OWNER: ["/dashboard/analytics", "/dashboard/customers", "/dashboard/marketing/whatsapp", "/dashboard/ai/predictions", "/dashboard/marketing/segments", "/dashboard/bookings"], MARKETING: ["/dashboard/marketing/whatsapp", "/dashboard/marketing/segments", "/dashboard/marketing/opportunities", "/dashboard/marketing/whatsapp/templates", "/dashboard/marketing/vouchers", "/dashboard/customers"], OPERATIONS: ["/dashboard/live", "/dashboard/bookings", "/dashboard/customers", "/dashboard/drivers", "/dashboard/fleet"], TECHNICAL: ["/dashboard/integrations", "/dashboard/integrations/needacabplus", "/dashboard/configuration", "/dashboard/configuration/system-health", "/dashboard/configuration/webhooks/events"] };
    const links = preferred[config.focus].flatMap(href => shortcuts.filter(link => link.href === href));
    if (config.widgets.includes("failed") && !links.some(link => link.href === "/dashboard/integrations/needacabplus")) {
        const integration = shortcuts.find(link => link.href === "/dashboard/integrations/needacabplus");
        if (integration)
            links.push(integration);
    }
    function destination(id:WorkspaceCard){
        if(id!=="revenue"&&id!=="margin")return cards[id].href;
        const date=(value:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
        const query=new URLSearchParams({preset:"custom",from:date(summary.from),to:date(new Date(new Date(summary.to).getTime()-1).toISOString()),payment:"ALL"});
        return cards[id].href+"?"+query.toString();
    }
    const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });
    return <main className="space-y-6 text-app-primary"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-app-muted">Hello, {name}</p><h1 className="mt-2 text-3xl font-semibold">My workspace</h1><p className="mt-2 text-app-muted">{focusLabels[config.focus]} · Your figures, priorities and shortcuts.</p></div><div className="flex flex-wrap items-end gap-2"><label className="text-sm">Period<select aria-label="Period" value={config.period} disabled={saving || loading || editing} onChange={e => void save({ ...config, period: e.target.value as WorkspaceConfig["period"] })} className="mt-1 block min-h-11 rounded-lg border border-app-border bg-surface px-3 py-2">{periods.map(p => <option value={p} key={p}>{periodLabels[p]}</option>)}</select></label><button className={button} disabled={loading || saving} onClick={() => void refresh()}>Refresh</button><button ref={customize} className={button + " border-brand"} disabled={saving} onClick={() => { setDraft(config); setEditing(true); setError(""); }}>Customize workspace</button></div></header>
 {error && <div role="alert" className="rounded-xl border border-red-500 p-4"><p>{error}</p><button className={button + " mt-3"} disabled={saving} onClick={() => void reload()}>Reload saved layout</button></div>}
 {notice && <p role="status" className="text-sm text-app-muted">{notice}</p>}
 {editing && <section aria-label="Customize workspace" className="space-y-5 rounded-2xl border border-brand bg-surface p-5"><div><h2 ref={editHeading} tabIndex={-1} className="text-xl font-semibold focus:outline-none">Customize your workspace</h2><p className="mt-2 text-sm text-app-muted">Choose a starting view, then add, hide and reorder cards. Available choices follow your existing access. Changes apply when you save.</p></div><fieldset disabled={saving}><legend className="font-medium">Starting view</legend><div className="mt-3 flex flex-wrap gap-2">{focuses.map(f => <button type="button" key={f} aria-pressed={draft.focus === f} className={button + (draft.focus === f ? " border-brand bg-brand-soft" : "")} onClick={() => setDraft({ ...draft, focus: f, widgets: presets[f].filter(id => allowed.includes(id)) })}>{focusLabels[f]}</button>)}</div><div className="mt-5 grid gap-5 md:grid-cols-2"><section><h3 className="font-medium">Cards to show</h3><div className="mt-3 space-y-1">{allowed.map(id => <label key={id} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={draft.widgets.includes(id)} onChange={e => setDraft(current => ({ ...current, widgets: e.target.checked ? [...current.widgets, id] : current.widgets.filter(x => x !== id) }))}/>{cards[id].label}</label>)}</div></section><section><h3 className="font-medium">Display order</h3>{!draft.widgets.length && <p className="mt-3 text-sm text-app-muted">No cards selected. You can keep just the shortcuts.</p>}<ol className="mt-3 space-y-2">{draft.widgets.map((id, i) => <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-app-border p-2"><span>{cards[id].label}</span><div className="flex gap-1"><button type="button" className={button} disabled={i === 0} aria-label={`Move ${cards[id].label} up`} onClick={() => move(i, -1)}>↑</button><button type="button" className={button} disabled={i === draft.widgets.length - 1} aria-label={`Move ${cards[id].label} down`} onClick={() => move(i, 1)}>↓</button></div></li>)}</ol></section></div></fieldset><div className="flex flex-wrap gap-2"><button className={button + " bg-brand text-white"} disabled={saving || loading} onClick={() => void save(draft)}>{saving ? "Saving…" : "Save layout"}</button><button className={button} disabled={saving} onClick={() => { setEditing(false); customize.current?.focus(); }}>Cancel</button>{legacy && <button className={button} disabled={saving} onClick={() => setDraft({ ...draft, widgets: legacy })}>Import previous browser layout</button>}</div><p className="text-sm text-app-muted">Your saved layout belongs to your account. It does not change anyone else’s layout or access.</p></section>}
 <section aria-label="Your selected cards" aria-busy={loading} className="space-y-4"><div className="flex flex-wrap justify-between gap-2 text-xs text-app-muted"><p>{periodLabels[config.period]} · {loading ? "Updating figures…" : summary.period!==config.period ? "Figures unavailable; refresh to retry" : `${when.format(new Date(summary.from))} – ${when.format(new Date(new Date(summary.to).getTime()-1))}`} · Europe/London</p><p>Updated {when.format(new Date(summary.generatedAt))}</p></div>{!config.widgets.length ? <div className="rounded-xl border border-app-border p-5"><p>No cards selected.</p><button className={button + " mt-3"} onClick={() => { setDraft(config); setEditing(true); }}>Add cards</button></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{config.widgets.map(id => { const metric = summary.metrics[id], busy = loading || summary.period !== config.period; return <article key={id} className="flex flex-col rounded-2xl border border-app-border bg-surface p-5"><h2 className="text-sm text-app-muted">{cards[id].label}</h2><p className="mt-3 text-3xl font-semibold tabular-nums">{cards[id].unit === "ACTION" ? (id === "retention" ? "Review profiles" : "Review campaigns") : busy ? (loading ? "…" : "Unavailable") : metric?.value === null || metric?.value === undefined ? "Unavailable" : format(metric.value, id)}</p>{!busy && metric && <><p className="mt-2 text-xs text-app-muted">{metric.snapshot ? "Current snapshot · not a period total" : metric.state !== "OK" || metric.value === null || metric.previous === null ? "Comparison unavailable" : `${metric.value - metric.previous > 0 ? "+" : ""}${format(Number((metric.value - metric.previous).toFixed(2)), id)} vs previous equivalent period`}</p>{metric.state === "PARTIAL" && <p className="mt-2 text-sm font-medium">Partial amount</p>}{metric.detail && <p className="mt-2 text-sm text-app-muted">{metric.detail}</p>}</>}<details className="mt-4 text-xs text-app-muted"><summary className="cursor-pointer">How this is counted</summary><p className="mt-2 leading-5">{cards[id].note}</p></details><Link href={destination(id)} aria-disabled={busy} tabIndex={busy?-1:undefined} onClick={event=>{if(busy)event.preventDefault();}} className="mt-4 inline-block text-sm underline">Open related view<span className="sr-only">: {cards[id].label}</span> →</Link>{(id==="revenue"||id==="margin")&&<p className="mt-1 text-xs text-app-muted">The related report groups journeys by pickup date.</p>}</article>; })}</div>}</section>
 {canUseAI && <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-app-border bg-surface p-5"><div><h2 className="font-semibold">TaxiCRM Agent</h2><p className="mt-1 text-sm text-app-muted">Ask about your reports and recorded signals.</p></div><Link className={button} href="/dashboard/ai/copilot">Open chat →</Link></section>}
 <section className="rounded-xl border border-app-border bg-surface p-5"><h2 className="font-semibold">Quick access</h2><nav aria-label="Workspace shortcuts" className="mt-4 flex flex-wrap gap-2">{links.map(link => <Link key={link.href} className={button} href={link.href}>{link.label} →</Link>)}</nav>{!links.length && <p className="mt-3 text-sm text-app-muted">No additional modules are available with your current access.</p>}</section>
 </main>;
}
