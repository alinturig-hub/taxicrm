import Link from "next/link";
export default function ModuleUnavailable({ unavailable = false }: { unavailable?: boolean }) {
  return <section className="rounded-2xl border border-slate-700 bg-surface p-6" role="status">
    <h1 className="text-2xl font-semibold">{unavailable ? "Module availability unavailable" : "Module disabled"}</h1>
    <p className="mt-3 text-sm text-slate-400">{unavailable ? "We could not verify the installation settings. Refresh to try again." : "An administrator has disabled this module for this installation. Existing data has been preserved."}</p>
    <Link href="/dashboard/workspace" className="mt-5 inline-block underline">Back to My workspace</Link>
  </section>;
}
