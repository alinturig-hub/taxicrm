"use client";
import { useCallback, useEffect, useState } from "react";

type Config = { enabled: boolean; phoneNumberId: string; templateName: string; language: string; graphVersion: string };
type Delivery = { id: string; bookingId: string; status: string; errorCode: string | null; createdAt: string };
const endpoint = "/api/dashboard/integrations/whatsapp";
const initial: Config = { enabled: false, phoneNumberId: "", templateName: "journey_completed", language: "en_GB", graphVersion: "v23.0" };
export default function WhatsAppSettings() {
  const [config, setConfig] = useState(initial), [token, setToken] = useState("");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]), [count, setCount] = useState(0);
  const [phone, setPhone] = useState(""), [evidence, setEvidence] = useState("");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Unable to load WhatsApp settings.");
    setConfig(data.config || initial); setDeliveries(data.deliveries); setCount(data.consentCount); setReady(true);
  }, []);
  useEffect(() => { void load().catch(error => setMessage(error.message)); }, [load]);
  async function save(body: unknown) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Unable to save.");
      setToken(""); await load(); setMessage("Saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save."); }
    finally { setBusy(false); }
  }
  const field = "mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-slate-900";
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <header><h1 className="text-2xl font-bold">WhatsApp · Journey complete</h1>
      <p>Send an approved Meta WhatsApp template after a completed journey. Only customers with recorded WhatsApp consent receive messages.</p></header>
    <p role="status" aria-live="polite">{message}</p>
    <form className="space-y-4 rounded border p-5" onSubmit={e => { e.preventDefault(); void save({ action: "configuration", ...config, accessToken: token }); }}>
      <h2 className="text-lg font-semibold">Meta WhatsApp Cloud API</h2>
      <p>Use an approved template with two body parameters, in order: customer first name and booking reference.</p>
      <blockquote className="rounded bg-slate-100 p-3 text-slate-900">Hi {"{{1}}"}, your journey with Need A Cab Plus is complete. Booking reference: {"{{2}}"}. Thank you for travelling with us.</blockquote>
      <label className="block">Meta phone number ID<input required className={field} value={config.phoneNumberId} onChange={e => setConfig({ ...config, phoneNumberId: e.target.value })} /></label>
      <label className="block">Approved template name<input required className={field} value={config.templateName} onChange={e => setConfig({ ...config, templateName: e.target.value })} /></label>
      <label className="block">Template language<input required className={field} value={config.language} onChange={e => setConfig({ ...config, language: e.target.value })} /></label>
      <label className="block">Graph API version<input required className={field} value={config.graphVersion} onChange={e => setConfig({ ...config, graphVersion: e.target.value })} /></label>
      <label className="block">Access token<input type="password" autoComplete="new-password" className={field} value={token} placeholder="Leave blank to keep the saved token" onChange={e => setToken(e.target.value)} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} /> Enable automatic messages for new completed journeys</label>
      <button disabled={busy || !ready} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">Save configuration</button>
      <p>Existing journeys are not backfilled. Repeated completion events do not send another message.</p>
    </form>
    <section className="space-y-3 rounded border p-5"><h2 className="text-lg font-semibold">Customer consent · {count} active</h2>
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); void save({ action: "consent", phone, evidence, granted: true }); }}>
        <label className="block">Customer phone<input required type="tel" className={field} value={phone} placeholder="+447…" onChange={e => setPhone(e.target.value)} /></label>
        <label className="block">Opt-in evidence<input required minLength={5} maxLength={1000} className={field} value={evidence} placeholder="Where and when the customer agreed to WhatsApp journey updates" onChange={e => setEvidence(e.target.value)} /></label>
        <button disabled={busy || !ready} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">Record opt-in</button>{" "}
        <button type="button" disabled={busy || !ready || !phone} className="rounded border px-4 py-2 disabled:opacity-50" onClick={() => void save({ action: "consent", phone, granted: false })}>Revoke consent</button>
      </form>
    </section>
    <section className="rounded border p-5"><h2 className="text-lg font-semibold">Recent messages</h2>
      <p>Accepted means Meta accepted the request; it does not confirm delivery. Unknown outcomes are not resent automatically.</p>
      {!deliveries.length ? <p>No message attempts yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Time</th><th>Booking</th><th>Status</th><th>Details</th></tr></thead><tbody>{deliveries.map(d => <tr key={d.id}><td>{new Date(d.createdAt).toLocaleString("en-GB")}</td><td>{d.bookingId}</td><td>{d.status}</td><td>{d.errorCode || "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
