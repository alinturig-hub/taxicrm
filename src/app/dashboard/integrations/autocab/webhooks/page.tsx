import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatEventType(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function AutocabWebhooksPage() {
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
          select: {
            id: true,
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
      },
    });

  const totalConfigurations = configurations.length;
  const enabledConfigurations = configurations.filter(
    (configuration) => configuration.isEnabled,
  ).length;
  const conditionalConfigurations = configurations.filter(
    (configuration) =>
      configuration.processingMode === "WHEN_CONDITIONS_MATCH",
  ).length;
  const totalConditions = configurations.reduce(
    (total, configuration) =>
      total + configuration.conditions.length,
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
            Autocab Integration
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            Webhook Manager
          </h1>

          <p className="mt-3 text-slate-400">
            Configurează endpoint-uri Autocab, reguli de procesare și
            condiții pentru fiecare eveniment.
          </p>
        </div>

        <Link
          href="/dashboard/integrations/autocab/webhooks/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Add Autocab Webhook
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Total Webhooks
          </p>
          <p className="mt-3 text-3xl font-bold text-white">
            {totalConfigurations}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Enabled
          </p>
          <p className="mt-3 text-3xl font-bold text-emerald-400">
            {enabledConfigurations}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Conditional
          </p>
          <p className="mt-3 text-3xl font-bold text-amber-400">
            {conditionalConfigurations}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Active Conditions
          </p>
          <p className="mt-3 text-3xl font-bold text-blue-400">
            {totalConditions}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-5">
          <h2 className="text-xl font-semibold text-white">
            Autocab Webhooks
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Endpoint-urile publice sunt generate folosind slug-ul
            configurației.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Webhook
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Event Type
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Endpoint
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Conditions
                </th>

                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Last Call
                </th>

                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {configurations.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-16 text-center"
                  >
                    <p className="text-base font-medium text-white">
                      No Autocab webhooks configured
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      Creează primul endpoint pentru a începe
                      procesarea evenimentelor Autocab.
                    </p>

                    <Link
                      href="/dashboard/integrations/autocab/webhooks/new"
                      className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      Add First Webhook
                    </Link>
                  </td>
                </tr>
              ) : (
                configurations.map((configuration) => {
                  const lastEvent =
                    configuration.webhookEvents[0] ?? null;

                  return (
                    <tr
                      key={configuration.id}
                      className="transition hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white">
                          {configuration.displayName}
                        </p>

                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                          {configuration.description ??
                            "No description"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="rounded-md bg-slate-800 px-3 py-1.5 font-mono text-xs text-slate-300">
                          {formatEventType(
                            configuration.eventType,
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <code className="whitespace-nowrap text-sm text-emerald-400">
                          /api/webhooks/autocab/
                          {configuration.endpointSlug}
                        </code>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            configuration.isEnabled
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {configuration.isEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {configuration.conditions.length}
                          </span>

                          <span className="text-xs text-slate-500">
                            {configuration.processingMode ===
                            "WHEN_CONDITIONS_MATCH"
                              ? configuration.conditionMode
                              : "Always"}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="text-sm text-slate-300">
                          {formatDate(
                            lastEvent?.receivedAt ?? null,
                          )}
                        </p>

                        {lastEvent ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {lastEvent.status}
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/integrations/autocab/webhooks/${configuration.id}`}
                          className="inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-400"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm font-medium text-slate-300">
          Autocab Webhook Base URL
        </p>

        <code className="mt-3 block overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-emerald-400">
          https://taxicrm.plymhub.ai/api/webhooks/autocab/
        </code>
      </div>
    </div>
  );
}
