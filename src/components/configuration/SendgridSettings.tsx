"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type { SendgridSender } from "@/lib/communications/sendgrid/store";

type Settings = { storageReady: boolean; configured: boolean; revision: number; senderEmail?: string; senderName?: string; additionalSenders?: SendgridSender[]; updatedAt?: string };
const messages: Record<string, string> = {
  FORBIDDEN: "You need configuration management access to manage SendGrid.",
  STORAGE_NOT_CONFIGURED: "Secure storage is not available. Ask your administrator to configure it.",
  STORAGE_UNAVAILABLE: "Saved settings could not be read. Please contact your administrator.",
  INVALID_SETTINGS: "Check the sender details and API key format.",
  KEY_REQUIRED: "Enter a new SendGrid API key.",
  REVISION_CONFLICT: "These settings changed in another session. Reload before trying again.",
  STORAGE_BUSY: "Another change is being saved. Try again shortly.",
  TEST_BUSY: "A connection test is already running. Try again shortly.",
};
export default function SendgridSettings() {
  const [settings, setSettings] = useState<Settings | null>(null), [senderEmail, setSenderEmail] = useState(""), [senderName, setSenderName] = useState(""), [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("Loading SendGrid settings…"), [error, setError] = useState(""), [busy, setBusy] = useState(false), [confirmRemove, setConfirmRemove] = useState(false), [retry, setRetry] = useState(0);
  const [recipient, setRecipient] = useState(""), [reviewTest, setReviewTest] = useState(false), [testResult, setTestResult] = useState("");
  const [testBusy, setTestBusy] = useState(false), [testUnknown, setTestUnknown] = useState(false);
  const [additionalSenders, setAdditionalSenders] = useState<SendgridSender[]>([]);
  const [testFrom, setTestFrom] = useState("");
  const testLock = useRef(false);
  const testSenderEmail = testFrom || settings?.senderEmail;

  const loadSavedSenders = useCallback((data: Settings) => {
    setSenderEmail(data.senderEmail || "");
    setSenderName(data.senderName || "");
    setAdditionalSenders(data.additionalSenders ?? []);
    setTestFrom("");
    setReviewTest(false);
  }, []);
  useEffect(() => { const controller = new AbortController(); setError(""); setStatus("Loading SendGrid settings…");
    fetch("/api/dashboard/integrations/sendgrid", { cache: "no-store", signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw Error(messages[data.error] || "Unable to load SendGrid settings."); if (!controller.signal.aborted) { setSettings(data); loadSavedSenders(data); setStatus(""); } }).catch(e => { if (!controller.signal.aborted) { setSettings(null); setError(e.message || "Unable to load SendGrid settings."); setStatus(""); } });
    return () => controller.abort();
  }, [loadSavedSenders, retry]);
  async function call(method: "PUT" | "POST" | "DELETE", payload: object) {
    if (busy || testLock.current) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const r = await fetch("/api/dashboard/integrations/sendgrid", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
      const data = await r.json(); if (!r.ok) throw Error(messages[data.error] || "Unable to complete the request.");
      if (method === "POST") {
        setStatus(data.state === "VERIFIED" ? data.canSend ? "SendGrid recognized the key and reports mail.send access. Sender verification has not been checked." : "SendGrid recognized the key, but mail.send access was not reported." : data.state === "NOT_VERIFIED" ? "SendGrid did not verify this key. Check its permissions or replace it." : "The connection test is unavailable. Try again later.");
      } else { setSettings(data); setApiKey(""); setConfirmRemove(false); loadSavedSenders(data); setStatus(method === "DELETE" ? "SendGrid settings removed from TaxiCRM. Revoke the key in SendGrid if it is no longer needed." : "Settings saved. Test the connection when ready."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to complete the request."); }
    finally { setBusy(false); }
  }
  function save(event: FormEvent) { event.preventDefault(); if (!settings || busy || testLock.current) return; void call("PUT", { senderEmail, senderName, additionalSenders, apiKey, expectedRevision: settings.revision }); }
  async function sendTestMessage() {
    if (!settings?.configured || !testSenderEmail || busy || testLock.current || testUnknown) return;
    testLock.current = true; setTestBusy(true); setTestResult(""); setReviewTest(false);
    try {
      const requestId = crypto.randomUUID();
      const response = await fetch("/api/dashboard/integrations/sendgrid/test-message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipient, senderEmail: testSenderEmail, requestId, expectedRevision: settings.revision, confirm: true }), signal: AbortSignal.timeout(25000) });
      const data = await response.json();
      if (data.error === "SENDER_NOT_CONFIGURED" || data.error === "REVISION_CONFLICT") {
        setTestResult("The saved senders changed. Refresh this page before sending a test.");
        return;
      }
      if (!response.ok || !["ACCEPTED", "REJECTED"].includes(data.state)) throw Error("UNKNOWN");
      setTestResult(data.state === "ACCEPTED" ? "SendGrid accepted the test email. Delivery has not been confirmed; check the recipient inbox." : "SendGrid rejected the test email. Check the key and verified sender in SendGrid before trying again.");
    } catch { setTestUnknown(true); setTestResult("The result is unknown. Check the recipient inbox and SendGrid activity before attempting another test; the email may have been accepted."); }
    finally { testLock.current = false; setTestBusy(false); }
  }
  const input = "mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand";
  return <section aria-labelledby="sendgrid-heading" className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="sendgrid-heading" className="text-xl font-semibold">Email · SendGrid</h2><p className="mt-2 text-sm text-slate-400">Connect your SendGrid account and manage the addresses you send from.</p></div><span className="rounded-lg border border-slate-700 px-3 py-1 text-xs">{!settings ? error ? "Unavailable" : "Loading…" : !settings.storageReady ? "Storage unavailable" : settings.configured ? "Settings saved" : "Not connected"}</span></div>
    <p className="mt-3 text-sm text-slate-400">Save a new, private API key. The connection test checks key permissions without sending email. Each From address must be authorized in SendGrid.</p>
    {status && <p role="status" className="mt-4 text-sm">{status}</p>}
    {error && <div role="alert" className="mt-4 text-sm text-red-300"><p>{error}</p>{!settings && <button type="button" className="mt-2 underline" onClick={() => setRetry(x => x + 1)}>Try again</button>}</div>}
    {settings && !settings.storageReady && <p role="status" className="mt-4 text-sm text-amber-300">Secure storage is not configured for this installation.</p>}
    {settings?.storageReady && <form onSubmit={save} className="mt-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Default sender name<input className={input} value={senderName} onChange={e => setSenderName(e.target.value)} maxLength={100} required autoComplete="off" /></label><label className="text-sm">Default sender email<input className={input} type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} maxLength={254} required autoComplete="off" /></label></div>
      <fieldset disabled={busy || testBusy} className="space-y-3">
        <legend className="font-semibold">Additional From addresses</legend>
        {additionalSenders.map((sender, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-slate-700 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Sender {index + 2} name<input className={input} value={sender.senderName} maxLength={100} required onChange={event => {
                const senderName = event.currentTarget.value;
                setAdditionalSenders(list => list.map((item, i) => i === index ? { ...item, senderName } : item));
              }} /></label>
              <label className="text-sm">Sender {index + 2} email<input className={input} type="email" value={sender.senderEmail} maxLength={254} required onChange={event => {
                const senderEmail = event.currentTarget.value;
                setAdditionalSenders(list => list.map((item, i) => i === index ? { ...item, senderEmail } : item));
              }} /></label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <button type="button" className="underline disabled:opacity-50" disabled={!sender.senderEmail || !sender.senderName || !senderEmail || !senderName} onClick={() => {
                setAdditionalSenders(list => list.map((item, i) => i === index ? { senderEmail, senderName } : item));
                setSenderEmail(sender.senderEmail);
                setSenderName(sender.senderName);
              }}>Make sender {index + 2} default</button>
              <button type="button" className="text-red-300 underline" onClick={() => setAdditionalSenders(list => list.filter((_, i) => i !== index))}>Remove sender {index + 2}</button>
            </div>
          </div>
        ))}
        <button type="button" disabled={additionalSenders.length >= 7} className="rounded-xl border border-slate-600 px-4 py-2 text-sm disabled:opacity-50" onClick={() => setAdditionalSenders(list => [...list, { senderEmail: "", senderName: "" }])}>Add sender</button>
        {additionalSenders.length > 0 && <p className="text-xs text-slate-400">Save settings to apply changes. Campaigns using a removed or edited sender are blocked from sending with that identity.</p>}
      </fieldset>
      <label className="block text-sm">SendGrid API key<input className={input} type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} maxLength={254} required={!settings.configured} autoComplete="new-password" placeholder={settings.configured ? "Saved · leave blank to keep it" : "Enter a new key"} /></label>
      <p className="text-xs text-slate-400">The key is encrypted on the server and never displayed again.</p>
      <div className="flex flex-wrap gap-3"><button disabled={busy || testBusy} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="submit">{busy ? "Working…" : "Save settings"}</button>{settings.configured && <><button disabled={busy || testBusy} type="button" className="rounded-xl border border-slate-600 px-4 py-2 text-sm disabled:opacity-50" onClick={() => void call("POST", { expectedRevision: settings.revision })}>Test connection</button><button disabled={busy || testBusy} type="button" className="rounded-xl border border-red-800 px-4 py-2 text-sm text-red-300 disabled:opacity-50" onClick={() => setConfirmRemove(true)}>Remove connection</button></>}</div>
      {confirmRemove && <div className="rounded-xl border border-red-800 p-4"><p className="text-sm">Remove the saved SendGrid settings from TaxiCRM?</p><div className="mt-3 flex gap-3"><button type="button" disabled={busy || testBusy} className="rounded-lg border border-red-700 px-3 py-2 text-sm text-red-300" onClick={() => void call("DELETE", { expectedRevision: settings.revision, confirm: true })}>Confirm removal</button><button type="button" disabled={busy || testBusy} className="rounded-lg border border-slate-600 px-3 py-2 text-sm" onClick={() => setConfirmRemove(false)}>Cancel</button></div></div>}
    </form>}
    {settings?.configured && <div className="mt-6 border-t border-slate-700 pt-5"><h3 className="font-semibold">Send a test email</h3><p className="mt-2 text-sm text-slate-400">Sends one test email from the selected saved address.</p><form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); setReviewTest(true); setTestResult(""); }}><label className="block text-sm"><span id="sendgrid-test-from-label">From</span><select aria-labelledby="sendgrid-test-from-label" className={input} value={testSenderEmail} disabled={busy || testBusy || testUnknown} onChange={e => { setTestFrom(e.target.value); setReviewTest(false); }}>
      <option value={settings.senderEmail}>{settings.senderName} · {settings.senderEmail} (default)</option>
      {settings.additionalSenders?.map(sender => <option key={sender.senderEmail} value={sender.senderEmail}>{sender.senderName} · {sender.senderEmail}</option>)}
      </select></label><label className="block text-sm">Test recipient<input className={input} type="email" value={recipient} onChange={e => { setRecipient(e.target.value); setReviewTest(false); }} maxLength={254} required disabled={testBusy || testUnknown} autoComplete="off" /></label><button type="submit" disabled={busy || testBusy || testUnknown} className="rounded-xl border border-slate-600 px-4 py-2 text-sm disabled:opacity-50">Review test email</button></form>
      {reviewTest && <div className="mt-3 rounded-xl border border-amber-700 p-4"><p className="text-sm">Send one test email from <strong>{testSenderEmail}</strong> to <strong>{recipient}</strong>?</p><div className="mt-3 flex gap-3"><button type="button" disabled={busy || testBusy} onClick={() => void sendTestMessage()} className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Send one test email</button><button type="button" disabled={testBusy} onClick={() => setReviewTest(false)} className="rounded-lg border border-slate-600 px-3 py-2 text-sm">Cancel</button></div></div>}
      {testBusy && <p role="status" className="mt-3 text-sm">Sending one test email…</p>}{testResult && <p role="status" className="mt-3 text-sm">{testResult}</p>}
      {testUnknown && <button type="button" className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm" onClick={() => { setTestUnknown(false); setTestResult(""); }}>I checked; prepare another test</button>}
    </div>}

  </section>;
}
