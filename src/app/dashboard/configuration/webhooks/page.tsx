import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BASE_URL =
  "https://taxicrm.plymhub.ai/api/webhooks/autocab";

const API_KEY_HEADER =
  process.env.AUTOCAB_WEBHOOK_API_KEY_HEADER?.trim() ||
  "x-autocab-api-key";

function formatDate(value: Date | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(value);
}

export default async function WebhooksPage() {
  const configurations =
    await prisma.autocabWebhookConfiguration.findMany({
      orderBy: [
        {
          isEnabled: "desc",
        },
        {
          displayName: "asc",
        },
      ],
      include: {
        conditions: {
          where: {
            isEnabled: true,
          },
          orderBy: {
            position: "asc",
          },
        },
        webhookEvents: {
          orderBy: {
            receivedAt: "desc",
          },
          take: 1,
          select: {
            receivedAt: true,
            status: true,
          },
        },
        _count: {
          select: {
            webhookEvents: true,
          },
        },
      },
    });

  const enabledCount = configurations.filter(
    (configuration) => configuration.isEnabled,
  ).length;

  const totalEvents = configurations.reduce(
    (total, configuration) =>
      total + configuration._count.webhookEvents,
    0,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
            Settings
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Webhooks
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Manage webhook sources and the event URLs used to
            receive real-time operational data.
          </p>
        </div>

        <Link
          href="/dashboard/configuration/webhooks/add"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          + Add Event URL
        </Link>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col justify-between gap-5 border-b border-slate-800 p-6 lg:flex-row lg:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
              A
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-white">
                  Autocab
                </h2>

                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  Enabled
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-400">
                Primary TaxiCRM real-time booking, driver and vehicle
                event source.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300">
              {enabledCount}/{configurations.length} URLs enabled
            </span>
          </div>
        </div>

        <div className="grid gap-px bg-slate-800 md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Base URL
            </p>

            <code className="mt-2 block break-all text-xs text-emerald-300">
              {BASE_URL}
            </code>
          </div>

          <div className="bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              API Key Header
            </p>

            <code className="mt-2 block text-sm text-slate-200">
              {API_KEY_HEADER}
            </code>
          </div>

          <div className="bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Event URLs
            </p>

            <p className="mt-2 text-2xl font-bold text-white">
              {configurations.length}
            </p>
          </div>

          <div className="bg-slate-900 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Events Received
            </p>

            <p className="mt-2 text-2xl font-bold text-white">
              {totalEvents.toLocaleString("en-GB")}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Event URLs
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Each event uses a dedicated public receiver URL.
            </p>
          </div>

          <span className="text-sm text-slate-500">
            {configurations.length} configured
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {configurations.map((configuration) => {
            const fullUrl =
              `${BASE_URL}/${configuration.endpointSlug}`;

            const lastEvent =
              configuration.webhookEvents[0] ?? null;

            return (
              <article
                key={configuration.id}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">
                        {configuration.displayName}
                      </h3>

                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          configuration.isEnabled
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : "border-slate-700 bg-slate-800 text-slate-400",
                        ].join(" ")}
                      >
                        {configuration.isEnabled
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </div>

                    <p className="mt-1 font-mono text-xs text-blue-300">
                      {configuration.eventType}
                    </p>
                  </div>

                  <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-400">
                    /{configuration.endpointSlug}
                  </span>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Event URL
                    </p>

                    <code className="mt-2 block break-all rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-emerald-300">
                      {fullUrl}
                    </code>
                  </div>

                  {configuration.description ? (
                    <p className="text-sm leading-6 text-slate-400">
                      {configuration.description}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] uppercase text-slate-500">
                        Received
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {configuration._count.webhookEvents.toLocaleString(
                          "en-GB",
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] uppercase text-slate-500">
                        Conditions
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {configuration.conditions.length}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <p className="text-[11px] uppercase text-slate-500">
                        Last received
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {formatDate(lastEvent?.receivedAt ?? null)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
