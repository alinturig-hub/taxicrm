import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
          select: {
            id: true,
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

  const conditionalCount = configurations.filter(
    (configuration) =>
      configuration.processingMode === "WHEN_CONDITIONS_MATCH",
  ).length;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-400">
              Configuration
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
              Webhooks
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
              Manage Autocab webhook endpoints, event-processing rules and the
              flow of real-time operational data into TaxiCRM.
            </p>
          </div>

          <Link
            href="/dashboard/configuration/webhooks/add"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
          >
            Add Webhook
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-400">
            Configured Webhooks
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {configurations.length}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Total Autocab webhook configurations
          </p>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-400">
            Enabled
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-emerald-300">
            {enabledCount}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Endpoints currently accepting events
          </p>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-400">
            Events Received
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {totalEvents}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Raw webhook events linked to configurations
          </p>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-medium text-slate-400">
            Conditional
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-amber-300">
            {conditionalCount}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Webhooks using conditional processing
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Autocab Webhook Configurations
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Each configuration generates a dedicated TaxiCRM receiver URL.
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
            {configurations.length} configured
          </span>
        </div>

        {configurations.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-2xl text-blue-300">
              ↗
            </div>

            <h3 className="mt-5 text-lg font-semibold text-white">
              No webhook configurations yet
            </h3>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Create the first Autocab webhook configuration to generate a
              receiver endpoint and begin collecting raw event payloads.
            </p>

            <Link
              href="/dashboard/configuration/webhooks/add"
              className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
            >
              Configure First Webhook
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-950/40">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Webhook
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Endpoint
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Processing
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Events
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {configurations.map((configuration) => {
                  const endpointUrl = `/api/webhooks/autocab/${configuration.endpointSlug}`;

                  return (
                    <tr
                      key={configuration.id}
                      className="transition hover:bg-slate-800/30"
                    >
                      <td className="whitespace-nowrap px-5 py-5">
                        <p className="font-semibold text-white">
                          {configuration.displayName}
                        </p>

                        <p className="mt-1 text-xs font-medium text-blue-300">
                          {configuration.eventType}
                        </p>

                        {configuration.description ? (
                          <p className="mt-2 max-w-xs truncate text-xs text-slate-500">
                            {configuration.description}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-5 py-5">
                        <code className="block max-w-sm break-all rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                          {endpointUrl}
                        </code>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5">
                        <p className="text-sm font-medium text-slate-300">
                          {configuration.processingMode === "ALWAYS"
                            ? "Always process"
                            : "Conditional"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {configuration.conditions.length} active condition
                          {configuration.conditions.length === 1 ? "" : "s"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5">
                        <p className="text-sm font-semibold text-white">
                          {configuration._count.webhookEvents}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          received
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                            configuration.isEnabled
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                              : "border-slate-700 bg-slate-800 text-slate-400",
                          ].join(" ")}
                        >
                          {configuration.isEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-5 text-right text-xs text-slate-500">
                        {formatDate(configuration.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
