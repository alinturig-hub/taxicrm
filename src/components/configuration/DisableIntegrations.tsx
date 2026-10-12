"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function DisableIntegrations({
  canManage,
}: {
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function disable() {
    if (
      !window.confirm(
        "Disable all existing webhook sources, webhook event URLs, configured APIs, Autocab driver sync, Geoapify and the SMS gateway? Saved data and credentials stay intact. Re-enable connections individually.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        "/api/dashboard/configuration/integrations-disable",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmation: "DISABLE_EXISTING_CONFIGURATIONS",
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error();
      const counts = result.disabled as Record<string, number>;
      const total = Object.values(counts).reduce(
        (sum, value) => sum + value,
        0,
      );
      setMessage(
        `${total} configurations disabled. Webhook sources: ${counts.webhookSources}; event URLs: ${counts.webhookEvents}; API endpoints: ${counts.apiEndpoints}; Autocab: ${counts.autocab}; Geoapify: ${counts.geoapify}; SMS: ${counts.sms}.`,
      );
      router.refresh();
    } catch {
      setMessage(
        "Unable to disable configurations. Check your access and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-red-500/20 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white">
            Disable existing integrations
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Turn off existing webhook sources and event URLs, configured APIs,
            Autocab driver sync, Geoapify and SMS delivery. Saved settings and
            data are kept. Re-enable connections individually.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            This changes existing connection settings. It cannot cancel requests
            already in progress or block new configurations and manual
            connection tests.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => void disable()}
            disabled={busy}
            className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy ? "Disabling…" : "Disable all webhooks & configured APIs"}
          </button>
        )}
      </div>
      <p role="status" className="mt-3 text-sm text-slate-300">
        {message}
      </p>
    </section>
  );
}
