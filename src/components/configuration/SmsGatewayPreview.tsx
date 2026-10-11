"use client";

import { useState } from "react";
import { smsGatewayPreview, type SmsGatewayDraft } from "@/lib/notifications/sms-gateway-preview";

export default function SmsGatewayPreview({initialConfiguration, signedParametersSaved = false}: {initialConfiguration?: SmsGatewayDraft; signedParametersSaved?: boolean}) {
  const [configuration, setConfiguration] = useState<SmsGatewayDraft>(initialConfiguration ?? {endpoint: "", phoneParameter: "customer_phone", messageParameter: "message", senderParameter: "sender", sender: "TaxiCRM"});
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Synthetic TaxiCRM gateway preview.");
  const [preview, setPreview] = useState<ReturnType<typeof smsGatewayPreview> | null>(null);
  const [error, setError] = useState<string | null>(null);
  function update(key: keyof SmsGatewayDraft, value: string) { setConfiguration(current => ({...current, [key]: value})); setPreview(null); setError(null); }
  return <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">Configuration preview only. Settings are not saved and no SMS is sent.</p>
    <button type="button" onClick={() => {setConfiguration({endpoint: "https://orionconnect.co.uk/api/endpoint/webhook", phoneParameter: "customer_phone", messageParameter: "message", senderParameter: "sender", sender: "TaxiCRM"}); setPreview(null); setError(null);}} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Use Orion SMS settings</button>
    <p className="text-sm text-slate-400">Paste the complete signed webhook URL. For Orion, use the SMS template {"{{message}}"}. Signed parameters are excluded from the request preview.</p>
    {signedParametersSaved ? <p className="text-sm text-emerald-300">Signed parameters are stored encrypted in the isolated environment. They are not displayed here. Delivery remains disabled.</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm text-slate-300">SMS HTTPS endpoint (including signed parameters)<input type="password" autoComplete="off" value={configuration.endpoint} onChange={event => update("endpoint", event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="text-sm text-slate-300">HTTP request format<input readOnly value="POST_JSON" className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-3" /></label>
      {([["phoneParameter", "Phone parameter name"], ["messageParameter", "Message parameter name"], ["senderParameter", "Sender parameter name"], ["sender", "Sender name"]] as const).map(([key, label]) => <label key={key} className="text-sm text-slate-300">{label}<input value={configuration[key]} onChange={event => update(key, event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-3" /></label>)}
      <label className="text-sm text-slate-300">Preview destination (international format)<input value={phone} onChange={event => {setPhone(event.target.value); setPreview(null);}} className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="text-sm text-slate-300">Preview message<textarea value={message} onChange={event => {setMessage(event.target.value); setPreview(null);}} className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-3" /></label>
    </div>
    <button type="button" onClick={() => {try {const request = smsGatewayPreview(configuration, phone, message); setPreview({...request, signedParametersPresent: request.signedParametersPresent || (signedParametersSaved && request.endpoint === initialConfiguration?.endpoint)}); setError(null);} catch (error) {setPreview(null); setError(error instanceof Error ? error.message : "Invalid configuration.");}}} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Preview SMS request</button>
    {error ? <p role="alert" className="text-red-300">{error}</p> : null}
    {preview ? <pre className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{JSON.stringify(preview, null, 2)}</pre> : null}
  </section>;
}
