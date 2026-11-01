"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
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
      <header className="rounded-3xl border border-app-border bg-surface p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-teal-400">TaxiCRM / Marketing</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-3xl font-semibold text-app-primary sm:text-4xl">Turn customer insight into action</h1><p className="mt-3 max-w-2xl text-app-muted">Plan the audience, approve the offer and follow the result in one workspace.</p></div><span className="rounded-full border border-amber-500/30 px-3 py-2 text-xs text-amber-500">Planning workspace · Sending not activated</span></div>
      </header>
      <section aria-label="Campaign journey" className="rounded-2xl border border-app-border bg-surface p-5">
        <h2 className="font-semibold text-app-primary">Your campaign journey</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{["Choose audience", "Define benefit", "Review budget", "Approve campaign", "Confirm activation", "Send and measure"].map((step,i)=><li key={step} className="rounded-xl border border-app-border p-3 text-sm text-app-muted"><span className="mb-2 block text-xs font-semibold text-teal-400">0{i+1}</span>{step}</li>)}</ol>
        <p className="mt-4 text-xs text-app-muted">AI can recommend. An operator approves. Benefits must be confirmed active before promotional messages are dispatched.</p>
      </section>
      <section aria-label="Marketing workspaces" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          {title:"Audiences",href:"/dashboard/marketing/segments",status:"Available",text:"Explore recorded behaviour tags and customer history. Marketing consent is checked separately."},
          {title:"Campaigns & WhatsApp",href:"/dashboard/marketing/whatsapp",status:"Local preview",text:"Review an audience and template plan for Meta or Com.Bot. Plans are not saved or sent yet."},
          {title:"Offers & benefits",href:"/dashboard/marketing/vouchers",status:"Connection required",text:"Benefits managed by Need A Cab Plus, assigned to verified customers without entering a public code."},
          {title:"Customer opportunities",href:"/dashboard/marketing/opportunities",status:"Available",text:"Review existing customer demand predictions and evidence before choosing an audience."},
        ].filter(card=>group.items.some(item=>item.href===card.href)).map(card=><Link key={card.href} href={card.href} className="rounded-2xl border border-app-border bg-surface p-5 transition hover:border-teal-500"><span className="text-xs text-app-muted">{card.status}</span><h2 className="mt-3 text-xl font-semibold text-app-primary">{card.title}</h2><p className="mt-3 text-sm leading-6 text-app-muted">{card.text}</p><span className="mt-5 inline-block text-sm text-teal-400">Open workspace →</span></Link>)}
        <article className="rounded-2xl border border-dashed border-app-border bg-surface p-5"><span className="text-xs text-app-muted">Not connected</span><h2 className="mt-3 text-xl font-semibold text-app-primary">Campaign results</h2><p className="mt-3 text-sm leading-6 text-app-muted">Activated benefits, accepted and delivered messages, redemptions, discount spend and booking outcomes will appear after execution is connected.</p><p className="mt-4 text-xs text-app-muted">No campaign results are available. No revenue uplift is inferred.</p></article>
        <article className="rounded-2xl border border-dashed border-app-border bg-surface p-5"><span className="text-xs text-app-muted">Design stage</span><h2 className="mt-3 text-xl font-semibold text-app-primary">Journeys & AI inbox</h2><p className="mt-3 text-sm leading-6 text-app-muted">Plan triggers and follow-ups, then review AI reply drafts. Workflow execution and inbound conversation handling are not active.</p></article>
      </section>
      {canReadCustomers && (
        <section aria-label="Recorded customer audiences" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-app-primary">
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
                className="rounded-2xl border border-app-border bg-surface p-5"
              >
                <p className="text-sm text-app-muted">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-app-primary">
                  {typeof value === "number"
                    ? value.toLocaleString("en-GB")
                    : "—"}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs leading-5 text-app-muted">
            Based on saved customer behaviour tags. Customers can belong to
            multiple segments; memberships are not unique customers. A segment
            is not permission to send marketing messages.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/dashboard/marketing/segments?tag=${encodeURIComponent(tag.id)}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-app-border bg-surface p-4 hover:border-blue-500/40"
              >
                <div>
                  <p className="text-sm font-semibold text-app-primary">
                    {tag.label}
                  </p>
                  <p className="mt-1 text-xs text-app-muted">{tag.category}</p>
                </div>
                <span className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-300">
                  {tag.customers.toLocaleString("en-GB")}
                </span>
              </Link>
            ))}
          </div>
          {data && !tags.length && (
            <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-app-muted">
              No active behaviour tags have been recorded yet. Customer profiles
              remain available in the directory.
            </p>
          )}
        </section>
      )}
      <section className="rounded-2xl border border-app-border bg-surface p-5"><h2 className="font-semibold text-app-primary">Before your first live campaign</h2><p className="mt-3 text-sm leading-6 text-app-muted">Connect the WhatsApp provider and Need A Cab Plus benefit API, verify customer identity and consent, then test manual approval and delivery with a controlled recipient. Budgets and campaign counts will appear only when persisted execution is implemented.</p></section>
    </div>
  );
}
