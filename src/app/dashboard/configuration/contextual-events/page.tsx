import Link from "next/link";

import ContextualEventsManager from "@/components/configuration/ContextualEventsManager";

export default function ContextualEventsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/10">
        <Link
          href="/dashboard/configuration"
          className="text-sm font-semibold text-blue-400 transition hover:text-blue-300"
        >
          ← Back to Configuration
        </Link>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
          Contextual Intelligence
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          City Events
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Add local events, football matches,
          concerts, university dates and transport
          disruptions. These records will help explain
          changes in customer demand and booking patterns.
        </p>
      </section>

      <ContextualEventsManager />
    </div>
  );
}
