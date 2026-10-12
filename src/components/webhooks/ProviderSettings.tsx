"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export type Provider = {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  apiKeyHeader: string;
  isEnabled: boolean;
  hasApiKey: boolean;
};
export default function ProviderSettings({
  provider,
  onClose,
}: {
  provider: Provider | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: provider?.name || "",
    description: provider?.description || "",
    baseUrl:
      provider?.baseUrl || "https://taxicrm.plymhub.ai/api/webhooks/autocab",
    apiKeyHeader: provider?.apiKeyHeader || "x-autocab-api-key",
    apiKey: "",
    isEnabled: provider?.isEnabled || false,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input =
    "mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white";
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/dashboard/autocab/providers${provider ? "/" + provider.id : ""}`,
        {
          method: provider ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Unable to save provider.");
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5"
    >
      <h2 className="text-xl text-white">
        {provider ? "Edit source" : "Add provider"}
      </h2>
      <p className="text-sm text-slate-400">
        Sources currently use the Autocab event format and TaxiCRM receiver. A
        custom base URL must forward to this receiver; saving makes no external
        requests.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["name", "Provider name"],
            ["description", "Source description"],
            ["baseUrl", "Main webhook URL"],
            ["apiKeyHeader", "API key header"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm text-slate-300">
            {label}
            <input
              className={input}
              required={key !== "description"}
              maxLength={key === "description" ? 2000 : 500}
              value={form[key]}
              onChange={(event) =>
                setForm({ ...form, [key]: event.target.value })
              }
            />
          </label>
        ))}
        <label className="text-sm text-slate-300">
          API key
          <input
            type="password"
            autoComplete="new-password"
            required={!provider?.hasApiKey && provider?.id !== "autocab"}
            minLength={16}
            maxLength={512}
            className={input}
            value={form.apiKey}
            onChange={(event) =>
              setForm({ ...form, apiKey: event.target.value })
            }
          />
          <span className="text-xs text-slate-500">
            Blank preserves an existing key. Saved keys are encrypted and never
            displayed.
          </span>
        </label>
      </div>
      <label className="flex gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={form.isEnabled}
          onChange={(event) =>
            setForm({ ...form, isEnabled: event.target.checked })
          }
        />
        Enable source
      </label>
      <div className="flex gap-3">
        <button
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white"
        >
          {busy ? "Saving…" : "Save source"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="px-4 py-2 text-slate-300"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
