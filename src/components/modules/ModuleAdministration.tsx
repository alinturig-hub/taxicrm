"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { modules } from "@/modules/core/registry";
import { isSwitchable, moduleImpact, parseModuleState, switchableModules, type ModuleState, type SwitchableModule } from "@/modules/core/activation/model";
const button = "min-h-11 rounded-lg border border-app-border bg-surface px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50";
export default function ModuleAdministration({ initial }: { initial: ModuleState | null }) {
  const router = useRouter();
  const [state, setState] = useState(initial), [pending, setPending] = useState<SwitchableModule | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const reloadButton = useRef<HTMLButtonElement>(null);
  const review = useRef<HTMLDivElement>(null), restore = useRef<HTMLButtonElement | null>(null);
  async function reload() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/dashboard/configuration/modules", { cache: "no-store" });
      if (!response.ok) throw Error("Module settings could not be loaded. Try again shortly.");
      setState(parseModuleState(await response.json())); setPending(null); router.refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!state || !pending || busy) return;
    const id = pending, enabled = !state.enabled[id];
    setBusy(true); setError(""); setNotice("");
    let failed = false;
    try {
      const response = await fetch("/api/dashboard/configuration/modules", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: state.revision, moduleId: id, enabled }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(response.status === 409 ? "Settings changed in another session. Reload settings before trying again." : "The change could not be confirmed. Reload settings to verify the current state before trying again.");
      setState(parseModuleState(body)); setPending(null);
      setNotice(`${modules[id].label} ${enabled ? "enabled" : "disabled"} for this installation. Existing data is preserved.`);
      router.refresh();
    } catch (e) { failed = true; setState(null); setError((e as Error).message); setPending(null); }
    finally { setBusy(false); requestAnimationFrame(() => failed ? reloadButton.current?.focus() : restore.current?.focus()); }
  }
  return <div className="space-y-6">
    <header><p className="text-xs uppercase tracking-widest text-brand">Configuration / Installation</p><h1 className="mt-2 text-3xl font-semibold">Product modules</h1>
      <p className="mt-3 max-w-3xl text-sm text-slate-400">Choose which isolated features this TaxiCRM installation offers to all users. Enabling a module never grants user permissions. Disabling preserves data and blocks new requests; re-enabling does not replay work or send messages.</p>
      <button ref={reloadButton} type="button" className={`${button} mt-4`} disabled={busy} onClick={reload}>Reload settings</button>
    </header>
    {notice && <p role="status" className="rounded-lg border border-brand p-3">{notice}</p>}
    {(error || !state) && <p role="alert" className="rounded-lg border border-amber-500 p-3">{error || "Module settings are unavailable. Reload settings to try again. Changes are disabled until settings can be verified."}</p>}
    <section aria-label="Available module controls" className="grid gap-4 lg:grid-cols-3">
      {switchableModules.map(id => <article key={id} className="rounded-2xl border border-app-border bg-surface p-5">
        <h2 className="text-lg font-semibold">{modules[id].label}</h2>
        <p className="mt-2 text-sm font-medium">{state ? state.enabled[id] ? "Enabled" : "Disabled" : "Status unavailable"}</p>
        <p className="mt-3 text-sm text-slate-400">{moduleImpact[id]}</p>
        <button className={`${button} mt-4`} type="button" disabled={!state || busy} onClick={event => {
          restore.current = event.currentTarget; setPending(id); setError(""); setNotice("");
          requestAnimationFrame(() => review.current?.focus());
        }}>{state?.enabled[id] ? "Disable" : "Enable"} {modules[id].label}</button>
      </article>)}
    </section>
    {pending && state && <div ref={review} tabIndex={-1} role="region" aria-label="Review module change" className="rounded-2xl border border-amber-500 p-5 focus:outline focus:outline-2 focus:outline-brand">
      <h2 className="text-xl font-semibold">{state.enabled[pending] ? "Disable" : "Enable"} {modules[pending].label} for all users?</h2>
      <p className="mt-3 text-sm">{state.enabled[pending] ? moduleImpact[pending] : "New requests will become available to users whose existing permissions allow them. No background work or messages will be replayed."}</p>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} disabled={busy} onClick={apply}>{busy ? "Saving…" : "Confirm change"}</button>
        <button type="button" className={button} disabled={busy} onClick={() => { setPending(null); restore.current?.focus(); }}>Cancel</button></div>
    </div>}
    <section aria-label="Other product modules" className="space-y-3"><h2 className="text-xl font-semibold">Other product modules</h2>
      <p className="text-sm text-slate-400">These existing capabilities remain available. Their shared dependencies are still being separated, so they cannot yet be disabled here. My workspace and Core remain required.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(modules).filter(([id]) => !isSwitchable(id)).map(([id, entry]) => <article key={id} className="rounded-xl border border-app-border p-4"><h3 className="font-medium">{entry.label}</h3><p className="mt-2 text-xs text-slate-400">{["core", "workspace"].includes(id) ? "Required" : "Existing capability · controls pending"}</p></article>)}</div>
    </section>
    <p className="text-xs text-slate-400">Changes are saved in the installation administration journal. Other open sessions may display previously loaded content until refreshed; new server requests check the current settings.</p>
  </div>;
}
