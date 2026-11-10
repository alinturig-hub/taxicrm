"use client";
import { useEffect, useRef, useState } from "react";
import type { ProviderId } from "@/lib/ai/owner-agent/providers";
type PublicSettings = { revision: number; provider: ProviderId; model: string; baseUrl: string; enabled: boolean; cloudConsent: boolean; hasKey: boolean; storageReady: boolean; usesDeploymentDefault: boolean };
const names = { NONE: "No model · verified reports only", OPENAI: "OpenAI", ANTHROPIC: "Claude · Anthropic", OLLAMA: "Ollama · local / company server" };
const errorText = (code: string) => ({
  PROVIDER_STORAGE_KEY_REQUIRED: "Secure provider storage needs administrator configuration.",
  PROVIDER_KEY_REQUIRED: "Enter a key for the selected cloud provider before enabling it.",
  PROVIDER_ENDPOINT_FIXED: "Cloud API destinations are fixed for this provider.",
  OLLAMA_ORIGIN_NOT_APPROVED: "This Ollama server is not approved by your administrator.",
  PROVIDER_REVISION_CONFLICT: "Settings changed. Reload the page before saving or testing.",
  MODEL_TEST_FAILED: "The model did not return a valid response. Check the model, key and service availability.",
  CLOUD_QUESTION_CONSENT_REQUIRED: "Confirm that user questions may be sent to this cloud provider.",
  AGENT_BUSY_RETRY: "Please wait a few seconds before trying again.",
  PROVIDER_NOT_ENABLED: "Save and enable a model before testing.",
} as Record<string, string>)[code] || "Provider settings could not be updated. Check your configuration and permissions.";
export default function OwnerAgentProviderSettings({ onSaved }: { onSaved: () => void }) {
  const [saved, setSaved] = useState<PublicSettings | null>(null), [draft, setDraft] = useState<PublicSettings | null>(null);
  const [key, setKey] = useState(""), [clearKey, setClearKey] = useState(false), [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const mounted = useRef(true), inputClass = "mt-1 block w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-app-primary";
  useEffect(() => {
    mounted.current = true; const abort = new AbortController();
    fetch("/api/dashboard/ai/owner-agent/provider", { cache: "no-store", signal: abort.signal }).then(async r => {
      const data = await r.json(); if (!r.ok) throw Error(errorText(data.error));
      if (mounted.current) { setSaved(data); setDraft(data); }
    }).catch(e => { if (mounted.current && e.name !== "AbortError") setError(e.message); });
    return () => { mounted.current = false; abort.abort(); };
  }, []);
  function change(patch: Partial<PublicSettings>) { if (draft) setDraft({ ...draft, ...patch }); setReview(false); setNotice(""); }
  async function save() {
    if (!saved || !draft || busy) return;
    setBusy(true); setError("");
    try {
      const settings = { provider: draft.provider, model: draft.model, baseUrl: draft.baseUrl, enabled: draft.enabled, cloudConsent: draft.cloudConsent, clearKey, ...(key ? { apiKey: key } : {}) };
      const r = await fetch("/api/dashboard/ai/owner-agent/provider", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true, expectedRevision: saved.revision, settings }) });
      const result = await r.json(); if (!r.ok) throw Error(errorText(result.error));
      if (mounted.current) { setSaved(result); setDraft(result); setKey(""); setClearKey(false); setReview(false); setNotice("Provider saved. No model request was sent and no API credit was used by saving."); onSaved(); }
    } catch (e) { if (mounted.current) { setKey(""); setError(e instanceof Error ? e.message : "Unable to save provider."); } }
    finally { if (mounted.current) setBusy(false); }
  }
  async function test() {
    if (!saved || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await fetch("/api/dashboard/ai/owner-agent/provider", { method: "POST", signal: AbortSignal.timeout(10000), headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true, expectedRevision: saved.revision }) });
      const result = await r.json(); if (!r.ok) throw Error(errorText(result.error));
      if (mounted.current) setNotice("Model test passed. A synthetic help question was used; no booking records were sent.");
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Model test failed."); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <details onToggle={e => { if (!e.currentTarget.open) setKey(""); }} className="rounded-2xl border border-app-border bg-surface p-5">
    <summary className="cursor-pointer font-semibold">Company AI provider & API key</summary>
    <p className="mt-3 text-xs leading-5 text-app-muted">Choose your provider and use your company account. Keys are encrypted on the server and never shown after saving. Cloud calls are charged by your provider. Saving settings does not contact the model.</p>
    {error && <p role="alert" className="mt-3 text-sm text-amber-600">{error}</p>}
    {draft && saved && <>
      {!saved.storageReady && <p className="mt-3 text-sm text-app-muted">Secure saved settings are not enabled yet. Ask your administrator to configure durable storage and the server encryption key.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-app-muted">Provider<select aria-label="Company AI provider" disabled={busy} className={inputClass} value={draft.provider} onChange={e => { const provider = e.target.value as ProviderId; change({ provider, model: "", baseUrl: "", enabled: false, cloudConsent: false }); setKey(""); setClearKey(provider === "NONE"); }}>{Object.entries(names).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        {draft.provider !== "NONE" && <label className="text-xs text-app-muted">Model ID<input aria-label="Company AI model" maxLength={100} className={inputClass} value={draft.model} onChange={e => change({ model: e.target.value })} placeholder="Enter a model available in your provider account" /></label>}
        {draft.provider === "OLLAMA" && <label className="text-xs text-app-muted">Approved Ollama server<input aria-label="Ollama server" className={inputClass} value={draft.baseUrl} onChange={e => change({ baseUrl: e.target.value })} placeholder="https://your-approved-model-server" /></label>}
        {draft.provider !== "NONE" && <label className="text-xs text-app-muted">{draft.provider === "OLLAMA" ? "Gateway key, if required" : "Company API key"}<input aria-label="Company AI API key" type="password" autoComplete="new-password" maxLength={2048} className={inputClass} value={key} onChange={e => { setKey(e.target.value); setClearKey(false); setReview(false); }} placeholder={saved.hasKey && saved.provider === draft.provider ? "Key saved · leave blank to retain for the same provider" : "Enter key; it will not be displayed again"} /></label>}
      </div>
      {draft.provider !== "NONE" && <div className="mt-4 space-y-3 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" checked={draft.enabled} onChange={e => change({ enabled: e.target.checked })} />Enable this provider for company questions</label>
        {draft.provider !== "OLLAMA" && <label className="flex items-start gap-2"><input type="checkbox" checked={draft.cloudConsent} onChange={e => change({ cloudConsent: e.target.checked })} />I allow user questions to be sent to this cloud provider. Raw booking records are not sent; questions can contain information entered by users.</label>}
        {saved.hasKey && <label className="flex items-start gap-2"><input type="checkbox" checked={clearKey} onChange={e => { setClearKey(e.target.checked); setKey(""); setReview(false); }} />Remove the saved key on confirmation</label>}
      </div>}
      <p className="mt-3 text-xs text-app-muted">Saved: {saved.usesDeploymentDefault ? "deployment default active · no company override" : `${names[saved.provider]} · ${saved.enabled ? "enabled" : "disabled"}`} · revision {saved.revision}. No key is shared or automatically reused across providers.</p>
      <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy || !saved.storageReady} onClick={() => setReview(true)} className="rounded-lg border border-app-border px-3 py-2 text-sm disabled:opacity-40">Review provider change</button><button disabled={busy || !saved.enabled} onClick={test} className="rounded-lg border border-app-border px-3 py-2 text-sm disabled:opacity-40">Test saved model · may use API credit</button></div>
      {review && <div className="mt-4 rounded-xl border border-brand/30 p-4"><p className="text-sm">Confirm {names[draft.provider]} · {draft.model || "no model"} · {draft.enabled ? "enabled" : "disabled"}. {key ? "A new key will be encrypted." : clearKey ? "The saved key will be removed." : "A key is retained only for the same provider and destination."} This changes the AI connection, not booking data or financial rules.</p><button disabled={busy} onClick={save} className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Confirm provider settings</button></div>}
      {notice && <p role="status" className="mt-3 text-sm text-brand">{notice}</p>}
    </>}
  </details>;
}
