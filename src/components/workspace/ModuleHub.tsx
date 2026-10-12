import Link from "next/link";
import type { NavigationGroup } from "@/lib/workspace/navigation";
export default function ModuleHub({ group }: { group: NavigationGroup }) {
  const shortcuts = group.items.filter((item) => !item.label.endsWith("hub"));
  return (
    <div className="space-y-7">
      <header className="rounded-2xl border border-slate-800 bg-surface p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
          TaxiCRM / {group.label}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {group.label}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          {group.description}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex min-h-40 flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-blue-500/50 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-sm font-semibold text-blue-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                aria-hidden="true"
                className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-blue-300"
              >
                ↗
              </span>
            </div>
            <h2 className="mt-3 text-base font-semibold text-white">
              {item.label}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {item.description}
            </p>
            <span className="mt-auto pt-3 text-xs font-medium text-blue-300">
              Open workspace →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
