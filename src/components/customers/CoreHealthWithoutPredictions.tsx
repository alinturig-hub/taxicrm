import type { coreHealthWithoutPredictions } from "@/modules/core/intelligence-health";
export default function CoreHealthWithoutPredictions({ core, reload, error }: { core: Awaited<ReturnType<typeof coreHealthWithoutPredictions>>; reload: () => void; error?: string | null }) {
  return <section className="space-y-5"><h1 className="text-3xl font-semibold">System health</h1>
    <p role="status" className="rounded-xl border border-app-border p-4">Predictions are disabled. Forecast health and accuracy are not evaluated. Customer snapshots and place enrichment remain independent.</p>
    {error && <p role="alert" className="rounded-lg border border-amber-500 p-3">{error}</p>}
    <button type="button" onClick={reload} className="min-h-11 rounded-lg border border-app-border px-4">Refresh health</button>
    <div className="grid gap-4 sm:grid-cols-2"><article className="rounded-xl border border-app-border p-4"><h2>Customer profiles</h2><p className="mt-2 text-2xl">{core.customers.toLocaleString("en-GB")}</p></article><article className="rounded-xl border border-app-border p-4"><h2>Saved profile snapshots</h2><p className="mt-2 text-2xl">{core.snapshots.toLocaleString("en-GB")}</p></article></div>
    <section><h2 className="font-semibold">Place processing</h2>{core.places.map(p => <p key={p.status}>{p.status}: {p.count.toLocaleString("en-GB")}</p>)}</section>
    <section><h2 className="font-semibold">Recent independent jobs</h2>{core.recentJobs.length ? core.recentJobs.map(job => <article className="mt-3 rounded-lg border border-app-border p-3" key={job.id}><p>{job.jobKey} · {job.status}</p><p className="text-sm">{job.message}</p></article>) : <p className="mt-2 text-sm text-slate-400">No independent job runs recorded yet.</p>}</section>
  </section>;
}
