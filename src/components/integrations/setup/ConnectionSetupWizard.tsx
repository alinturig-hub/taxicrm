"use client";

import { useEffect, useState } from "react";
import { createConnectionPlan, type ConnectionPlan, type DataSource } from "@/lib/integrations/connection-plan";

export default function ConnectionSetupWizard({ canSaveDraft = false }: { canSaveDraft?: boolean }) {
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [source, setSource] = useState<DataSource>("NEEDACABPLUS");
  const [storage, setStorage] = useState<ConnectionPlan["storage"]>("CURRENT_DATABASE");
  const [plan, setPlan] = useState<ConnectionPlan | null>(null);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [connections, setConnections] = useState<Array<{ id: string; displayName: string; status: string }>>([]);
  useEffect(() => {
    if (!canSaveDraft) return;
    let active = true;
    fetch("/api/dashboard/integrations/connections", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Draft registry unavailable. Local schema setup may be required.");
        const data = await response.json();
        if (active) setConnections(data.connections);
      }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [canSaveDraft]);
  const field = "mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white";
  function review() {
    try {
      setPlan(createConnectionPlan({ companyName, source, storage }));
      setRequestId(crypto.randomUUID()); setSavedId("");
      setError(""); setStep(2);
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid plan."); }
  }
  function download() {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "taxicrm-connection-plan.json";
    link.click(); URL.revokeObjectURL(url);
  }
  async function save() {
    if (!plan || saving || !canSaveDraft) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/dashboard/integrations/connections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: plan.companyName, source: plan.source, storage: plan.storage, requestId }),
      });
      if (!response.ok) throw new Error("Could not save draft. Existing connections were not changed.");
      const { connection } = await response.json();
      setSavedId(connection.id);
      setConnections(items => [connection, ...items.filter(item => item.id !== connection.id)].slice(0, 50));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save draft."); }
    finally { setSaving(false); }
  }
  return <section className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <h2 className="text-xl font-semibold text-white">Plan a connection</h2>
    <p className="text-sm text-slate-400">Draft only. {canSaveDraft ? "Save your plan in TaxiCRM or download it." : "Download your plan to keep it. Draft storage in TaxiCRM is not enabled for this deployment."} Planning does not change credentials, connect a database, import data or activate webhooks.</p>
    <ol aria-label="Setup progress" className="flex flex-wrap gap-4 text-sm">
      {["Company & source", "Storage", "Review"].map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined} className={step === i ? "font-semibold text-blue-300" : "text-slate-400"}>{i + 1}. {label}</li>)}
    </ol>
    {step === 0 && <div className="space-y-4">
      <label className="block text-slate-200">Company name<input className={field} maxLength={120} value={companyName} onChange={e => setCompanyName(e.target.value)} autoComplete="organization" /></label>
      <label className="block text-slate-200">Data source<select className={field} value={source} onChange={e => setSource(e.target.value as DataSource)}>
        <option value="NEEDACABPLUS">NeedACabPlus</option><option value="AUTOCAB">Autocab direct</option><option value="LOCAL">Local import or system</option>
      </select></label>
      <p className="text-sm text-slate-400">A provider supplies data. TaxiCRM stores and uses CRM data. Selecting a source here does not replace the current writer.</p>
    </div>}
    {step === 1 && <div className="space-y-4">
      <label className="block text-slate-200">Storage plan<select className={field} value={storage} onChange={e => setStorage(e.target.value as ConnectionPlan["storage"])}>
        <option value="CURRENT_DATABASE">Keep the current database connection</option><option value="DEDICATED_DATABASE">Plan a separate company database</option>
      </select></label>
      <p className="text-sm text-slate-400">A separate database needs provisioning and migration approval. The current schema does not provide complete company isolation in a shared database. No database URL or password is collected here.</p>
    </div>}
    {step === 2 && plan && <div className="space-y-4">
      <p className="text-slate-200">Draft for <strong>{plan.companyName}</strong> · {plan.source} · {plan.storage === "CURRENT_DATABASE" ? "Current database" : "Separate database requested"}</p>
      <p className="text-sm text-slate-400">Business dates: Europe/London. Existing connection preserved. Activation is blocked until the requirements below are completed.</p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">{plan.requirements.map(item => <li key={item}>{item}</li>)}</ul>
    </div>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {savedId && <p role="status" className="text-emerald-300">Draft saved in TaxiCRM. The existing connection is unchanged.</p>}
    <div className="flex gap-3">
      {step > 0 && <button type="button" className="rounded-xl border border-slate-700 px-4 py-2 text-white" onClick={() => { setError(""); setStep(step - 1); }}>Back</button>}
      {step === 0 && <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-white" onClick={() => { if (!companyName.trim()) { setError("Enter a company name."); return; } setError(""); setStep(1); }}>Continue</button>}
      {step === 1 && <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-white" onClick={review}>Review plan</button>}
      {step === 2 && <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-white" onClick={download}>Download draft plan</button>}
      {step === 2 && canSaveDraft && <button type="button" disabled={saving || Boolean(savedId)} className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50" onClick={save}>{saving ? "Saving…" : savedId ? "Draft saved" : "Save draft in TaxiCRM"}</button>}
    </div>
    {connections.length > 0 && <section aria-label="Saved connection drafts" className="space-y-2 border-t border-slate-700 pt-4">
      <h3 className="font-semibold text-white">Connection registry</h3>
      <ul className="space-y-2 text-sm text-slate-300">{connections.map(connection => <li key={connection.id}>{connection.displayName} · {connection.status}</li>)}</ul>
    </section>}
  </section>;
}
