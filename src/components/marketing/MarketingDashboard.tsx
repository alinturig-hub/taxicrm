"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ModuleHub from "@/components/workspace/ModuleHub";
import type { NavigationGroup } from "@/lib/workspace/navigation";
type Tag = { id: string; label: string; category: string; customers: number };
type AudienceData = {
  summary?: { normalCustomers: number };
  availableTags?: Tag[];
};
export default function MarketingDashboard({
  group,
}: {
  group: NavigationGroup;
}) {
  const [data, setData] = useState<AudienceData | null>(null);
  const [error, setError] = useState("");
  const canReadCustomers = group.items.some(
    (i) => i.href === "/dashboard/marketing/segments",
  );
  useEffect(() => {
    if (!canReadCustomers) return;
    const controller = new AbortController();
    void fetch("/api/dashboard/customers?limit=1", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success)
          throw new Error("Customer audiences could not be loaded.");
        setData(payload);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [canReadCustomers]);
  const tags = data?.availableTags ?? [];
  return (
    <div className="space-y-7">
      <ModuleHub group={group} />
      {canReadCustomers && (
        <section aria-label="Recorded customer audiences" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">
              Your recorded audiences
            </h2>
            <Link
              href="/dashboard/marketing/segments"
              className="text-sm font-medium text-blue-300"
            >
              Explore customers →
            </Link>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200"
            >
              {error}{" "}
              <button
                className="underline"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Individual customers", data?.summary?.normalCustomers],
              ["Active behaviour segments", data ? tags.length : undefined],
              [
                "Segment memberships",
                data
                  ? tags.reduce((sum, tag) => sum + tag.customers, 0)
                  : undefined,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
              >
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {typeof value === "number"
                    ? value.toLocaleString("en-GB")
                    : "—"}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Based on saved customer behaviour tags. Customers can belong to
            multiple segments; memberships are not unique customers. A segment
            is not permission to send marketing messages.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/dashboard/marketing/segments?tag=${encodeURIComponent(tag.id)}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-blue-500/40"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    {tag.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{tag.category}</p>
                </div>
                <span className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-300">
                  {tag.customers.toLocaleString("en-GB")}
                </span>
              </Link>
            ))}
          </div>
          {data && !tags.length && (
            <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              No active behaviour tags have been recorded yet. Customer profiles
              remain available in the directory.
            </p>
          )}
        </section>
      )}
      <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6">
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
          Next module
        </span>
        <h2 className="mt-4 text-lg font-semibold text-white">
          Campaigns & communication journeys
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Audience selection, message approval, consent and unsubscribe records,
          delivery history and campaign outcomes will form a separate campaign
          workspace. Bulk marketing sending is not available yet. Operational
          freephone alerts remain in Configuration.
        </p>
      </section>
    </div>
  );
}
