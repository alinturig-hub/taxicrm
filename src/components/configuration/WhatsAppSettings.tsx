"use client";
import React, { useEffect, useState } from "react";
import type { whatsappSettings } from "@/lib/integrations/whatsapp/settings";
import type { listTemplates, templatePreview, TemplateDraft } from "@/lib/integrations/whatsapp/templates";
type Setup = { settings: ReturnType<typeof whatsappSettings>; canManage: boolean };
const endpoint = "/api/dashboard/configuration/whatsapp";
const errors: Record<string, string> = {
  SIGN_IN_REQUIRED: "Sign in to manage WhatsApp.", WHATSAPP_PERMISSION_REQUIRED: "Configuration and integration permissions are required.", WHATSAPP_DISABLED: "Meta connection is disabled in server settings.", WHATSAPP_SETUP_REQUIRED: "Complete the secure server configuration first.",
  META_ACCESS_DENIED: "Meta denied access. Check the token, assigned WABA and whatsapp_business_management permission.", META_RATE_LIMITED: "Meta rate limit reached. Wait before retrying.", META_CONNECTION_FAILED: "Could not connect to Meta. No messages or template submissions were sent.", META_REQUEST_FAILED: "Meta could not list templates. Check the API version and account access.", META_INVALID_RESPONSE: "Meta returned an unexpected response.", META_RESPONSE_TOO_LARGE: "Meta response exceeded the safe size limit.", WHATSAPP_BUSY_RETRY: "Another request is running or was just completed. Wait a few seconds.",
  INVALID_TEMPLATE_NAME: "Use only lowercase letters, numbers and underscores in the template name (maximum 512 characters).", UNSUPPORTED_LANGUAGE: "Choose English (UK), English (US) or Romanian.", UNSUPPORTED_CATEGORY: "This editor supports Utility and Marketing body-only templates.", INVALID_TEMPLATE_TEXT: "Enter a message of 1–1,024 characters without control characters.", INVALID_VARIABLES: "Use numbered variables such as {{1}}. Named or malformed variables are not supported.", VARIABLES_MUST_BE_SEQUENTIAL: "Use consecutive variables {{1}}, {{2}}, and so on, up to 10.", VARIABLE_SAMPLES_REQUIRED: "Provide one non-empty sample line for each numbered variable, in order (maximum 200 characters each).",
};
const errorText = (code: unknown) => typeof code === "string" ? errors[code] || "WhatsApp setup could not complete this request." : "WhatsApp setup is unavailable.";
const input = "mt-1 w-full rounded-lg border border-app-border bg-surface px-3 py-2 text-sm text-app-primary";
export default function WhatsAppSettings({ connectionOnly = false }: { connectionOnly?: boolean }) {
  const [setup, setSetup] = useState<Setup | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof listTemplates>> | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof templatePreview> | null>(null);
  const [draft, setDraft] = useState<Omit<TemplateDraft, "samples">>({ name: "booking_update", language: "en_GB", category: "UTILITY", text: "Hello {{1}}, your booking reference is {{2}}. Thank you." });
  const [samples, setSamples] = useState("Example customer\nSYNTHETIC-123");
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw Error(errorText(data.error)); setSetup(data); }).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, []);
  async function action(kind: "list" | "preview") {
    if (busy) return; setBusy(true); setError("");
    if (kind === "list") setTemplates(null); else setPreview(null);
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(12000), body: JSON.stringify({ action: kind, ...(kind === "preview" ? { draft: { ...draft, samples: samples ? samples.split("\n") : [] } } : {}) }) });
      const body = await r.json(); if (!r.ok) throw Error(errorText(body.error));
      if (kind === "list") setTemplates(body); else setPreview(body);
    } catch (e) { setError(e instanceof Error ? e.message : "WhatsApp request failed."); }
    finally { setBusy(false); }
  }
  function update(field: keyof typeof draft, value: string) { setDraft(v => ({ ...v, [field]: value })); setPreview(null); }
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-7">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-brand">{connectionOnly ? "Integrations / WhatsApp" : "Marketing / WhatsApp"}</p><h1 className="mt-2 text-3xl font-semibold">{connectionOnly ? "Meta WhatsApp connection" : "WhatsApp templates"}</h1><p className="mt-2 text-sm text-app-muted">{connectionOnly ? "Review the Meta account and secure server configuration." : "Browse Meta templates and prepare message drafts."}</p></header>
    {error && <p role="alert" className="rounded-xl border border-amber-500/30 p-4 text-sm">{error}</p>}
    {!setup ? <p className="text-sm text-app-muted">{error ? "Setup could not be loaded." : "Checking server configuration…"}</p> : <>
      {connectionOnly && <><section className="rounded-2xl border border-app-border bg-surface p-5"><h2 className="font-semibold">Connection readiness</h2><p className="mt-2 text-sm text-brand">{setup.settings.enabled && setup.settings.ready ? "Configured · Meta access not yet verified" : "Not activated"}</p>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">{[["Meta App ID", setup.settings.appId || "Required"], ["WhatsApp Business Account ID", setup.settings.wabaId || "Required"], ["Graph API version", setup.settings.graphVersion || "Required"], ["Server access token", setup.settings.hasToken ? "Configured securely · hidden" : "Required"]].map(([label, value]) => <div key={label}><dt className="text-xs text-app-muted">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}</dl>
        <ul className="mt-4 space-y-2 text-xs text-app-muted">{setup.settings.issues.map(issue => <li key={issue}>{issue}</li>)}</ul><p className="mt-4 text-xs text-app-muted">An administrator configures credentials in secure server settings. No token is entered here or returned to this browser. Saving server settings does not send messages.</p>
      </section>
      <section className="rounded-2xl border border-app-border bg-surface p-5"><h2 className="font-semibold">Activation checklist</h2><ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-app-muted"><li>Create your Meta app and associate the existing business portfolio.</li><li>Assign the existing WABA and grant whatsapp_business_management to the authorized token.</li><li>Configure the App ID, WABA ID, supported Graph version and token securely on the server.</li><li>Enable the read connection and explicitly list templates to verify access.</li></ol><p className="mt-4 text-xs text-app-muted">Do not move or re-register the phone number, change Com.Bot webhooks or revoke its credentials for this setup. Actual shared access still needs verification.</p></section>
      </>}
      {!connectionOnly && <><section className="rounded-2xl border border-app-border bg-surface p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Existing templates</h2><button disabled={busy || !setup.canManage || !setup.settings.ready || !setup.settings.enabled} onClick={() => action("list")} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">List templates from Meta</button></div><p className="mt-2 text-xs text-app-muted">Read-only, on demand. No background sync or automatic retries. This first version displays up to 25 templates.</p>
        {templates && <><p role="status" className="mt-3 text-sm">{templates.templates.length} templates received · {new Date(templates.fetchedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} Europe/London.{templates.hasMore ? " More templates exist; pagination is not enabled yet." : ""}</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{templates.templates.map((t, i) => <article key={t.id || i} className="min-w-0 rounded-xl border border-app-border p-4"><h3 className="break-all font-medium">{t.name}</h3><p className="mt-2 text-xs text-app-muted">{t.status} · {t.category} · {t.language}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm">{t.body}</p></article>)}</div></>}
      </section>
      <section className="rounded-2xl border border-app-border bg-surface p-5"><h2 className="font-semibold">Prepare a template</h2><p className="mt-2 text-xs text-app-muted">Body-only drafts with numbered variables. Preview works without a Meta token. Drafts stay in this tab and are lost on reload; nothing is saved to the CRM database or submitted to Meta.</p>
        {!setup.canManage && <p className="mt-3 text-sm text-app-muted">Integration management permission is required to prepare previews or list templates.</p>}
        <form onSubmit={e => { e.preventDefault(); action("preview"); }} className="mt-4 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Template name<input maxLength={512} className={input} value={draft.name} onChange={e => update("name", e.target.value)} /></label><label className="text-sm">Language<select className={input} value={draft.language} onChange={e => update("language", e.target.value)}><option value="en_GB">English (UK)</option><option value="en_US">English (US)</option><option value="ro">Romanian</option></select></label><label className="text-sm">Category<select className={input} value={draft.category} onChange={e => update("category", e.target.value)}><option value="UTILITY">Utility</option><option value="MARKETING">Marketing</option></select></label></div><label className="block text-sm">Message body<textarea maxLength={1024} rows={5} className={input} value={draft.text} onChange={e => update("text", e.target.value)} /></label><label className="block text-sm">Variable samples · one per line<textarea maxLength={2200} rows={3} className={input} value={samples} onChange={e => { setSamples(e.target.value); setPreview(null); }} /></label><p className="text-xs text-app-muted">Use synthetic examples, not real customer details.</p><button disabled={busy || !setup.canManage} className="rounded-lg border border-app-border px-4 py-2 text-sm disabled:opacity-40">Validate & preview locally</button></form>
        {preview && <div className="mt-5 rounded-xl border border-brand/30 p-4"><h3 className="font-medium">Local preview</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm">{preview.renderedText}</p><p role="status" className="mt-3 text-xs text-app-muted">{preview.notice}</p><details className="mt-4 text-xs"><summary>Prepared Meta payload</summary><pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(preview.payload, null, 2)}</pre></details></div>}
      </section><p className="text-xs text-app-muted">Template submission, authentication templates, media/buttons, messaging, webhooks and database persistence are not activated by this setup.</p></>}
    </>}
  </main>;
}
