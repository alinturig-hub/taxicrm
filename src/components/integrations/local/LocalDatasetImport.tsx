"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function LocalDatasetImport() {
  const router = useRouter();
  const [name, setName] = useState(""),
    [recordKey, setRecordKey] = useState("id"),
    [raw, setRaw] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{
    records: number;
    preview: unknown;
    previewToken: string;
  } | null>(null);
  async function submit(action: "preview" | "save") {
    setBusy(true);
    setMessage("");
    try {
      const payload = JSON.parse(raw);
      const response = await fetch("/api/dashboard/integrations/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          name,
          recordKey,
          payload,
          previewToken: preview?.previewToken,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to import.");
      if (action === "preview") setPreview(result);
      else {
        setPreview(null);
        setMessage(
          result.alreadySaved
            ? "This preview was already saved."
            : `${result.stored.created} local records saved.`,
        );
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON.");
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white";
  return (
    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-semibold text-white">Import local data</h2>
      <p className="text-sm text-slate-400">
        Paste JSON or select a JSON file, preview it, then save it in TaxiCRM.
        Saved datasets do not automatically create bookings, customers or
        financial rules.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-300">
          Dataset name
          <input
            className={input}
            maxLength={200}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setPreview(null);
            }}
          />
        </label>
        <label className="text-sm text-slate-300">
          Record key
          <input
            className={input}
            value={recordKey}
            onChange={(event) => {
              setRecordKey(event.target.value);
              setPreview(null);
            }}
          />
          <small>Blank saves the whole response.</small>
        </label>
      </div>
      <label className="block text-sm text-slate-300">
        JSON file
        <input
          className={input}
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 512 * 1024) {
              setMessage("Use files up to 512 KB.");
              return;
            }
            setRaw(await file.text());
            setPreview(null);
          }}
        />
      </label>
      <label className="block text-sm text-slate-300">
        JSON data
        <textarea
          aria-label="JSON data"
          className={`${input} min-h-40 font-mono text-xs`}
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setPreview(null);
          }}
        />
      </label>
      <div className="flex gap-3">
        <button
          className="rounded-xl border border-slate-700 px-4 py-2 text-slate-200"
          disabled={busy || !name.trim() || !raw.trim()}
          onClick={() => void submit("preview")}
        >
          {busy ? "Working…" : "Preview local data"}
        </button>
        <button
          className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-40"
          disabled={busy || !preview}
          onClick={() => void submit("save")}
        >
          Save local data
        </button>
      </div>
      {preview && (
        <div>
          <p className="text-sm text-slate-300">
            {preview.records} records ready to save. First 5 shown.
          </p>
          <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-300">
            {JSON.stringify(preview.preview, null, 2)}
          </pre>
        </div>
      )}
      <p role="status" className="text-sm text-slate-300">
        {message}
      </p>
    </section>
  );
}
