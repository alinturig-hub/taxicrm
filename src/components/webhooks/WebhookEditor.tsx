"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Configuration = {
  id: string;
  displayName: string;
  description: string | null;
  isEnabled: boolean;
  eventType: string;
  endpointSlug: string;
  processingMode: string;
  conditionMode: string;
  conditions: { id: string; fieldPath: string; operator: string }[];
};
export default function WebhookEditor({
  configuration,
  baseUrl,
  canManage,
}: {
  configuration: Configuration;
  baseUrl: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(configuration.displayName),
    [description, setDescription] = useState(configuration.description || ""),
    [enabled, setEnabled] = useState(configuration.isEnabled),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/dashboard/autocab/webhooks/${configuration.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: name,
            description,
            isEnabled: enabled,
          }),
        },
      );
      if (!response.ok) throw new Error();
      setMessage("Webhook configuration saved.");
      router.refresh();
    } catch {
      setMessage("Unable to save. Check your access and try again.");
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white";
  return (
    <div className="max-w-3xl space-y-5">
      <Link
        className="text-sm text-blue-300"
        href="/dashboard/configuration/webhooks"
      >
        ← Webhook configuration
      </Link>
      <header>
        <h1 className="text-2xl font-semibold text-white">Edit webhook</h1>
        <p className="mt-2 text-sm text-slate-400">{configuration.eventType}</p>
      </header>
      <code className="block break-all rounded-xl border border-slate-700 p-4 text-xs text-blue-200">
        {baseUrl}/{configuration.endpointSlug}
      </code>
      <form
        onSubmit={save}
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
      >
        <fieldset disabled={!canManage || busy} className="space-y-4">
          <label className="block text-sm text-slate-300">
            Event name
            <input
              className={input}
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Description
            <textarea
              className={input}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="flex gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enable event URL
          </label>
          {canManage && (
            <button
              className="rounded-xl bg-blue-600 px-4 py-2 text-white"
              type="submit"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          )}
        </fieldset>
        <p role="status" className="text-sm text-slate-300">
          {message}
        </p>
        {!canManage && (
          <p className="text-sm text-slate-400">
            Read-only: configuration.manage permission is required to edit.
          </p>
        )}
      </form>
      <section className="rounded-xl border border-slate-800 p-5">
        <h2 className="font-semibold text-white">Processing rules</h2>
        <p className="mt-2 text-sm text-slate-400">
          {configuration.processingMode} · {configuration.conditionMode}
        </p>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {configuration.conditions.map((condition) => (
            <li key={condition.id}>
              {condition.fieldPath} · {condition.operator}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Saving preserves the event type, URL and processing conditions.
        </p>
      </section>
    </div>
  );
}
