import Link from "next/link";
import { workspaceAccess } from "@/lib/workspace/access";
export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  const { access, groups } = await workspaceAccess();
  const workspaces = groups.filter((g) => g.id !== "overview");
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-blue-950/30 p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            Your CRM workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            Welcome, {access.user.name || "team"}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            Run the operation. Understand your customers. Plan the next
            relationship.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-blue-400"
        >
          View business overview ↗
        </Link>
      </header>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((group, index) => (
          <article
            key={group.id}
            className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-6"
          >
            <span className="text-xs font-semibold tracking-widest text-blue-400">
              WORKSPACE {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-4 text-xl font-semibold text-white">
              {group.label}
            </h2>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
              {group.description}
            </p>
            <div className="mt-5 space-y-1 border-t border-slate-800 pt-3">
              {group.items.slice(0, 3).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
            <Link
              href={group.items[0].href}
              className="mt-auto pt-5 text-sm font-semibold text-blue-300"
            >
              Open {group.label.toLowerCase()} →
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
