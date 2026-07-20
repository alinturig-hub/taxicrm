import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(value);
}

function getStatusClass(status: string) {
  switch (status) {
    case "PROCESSED":
      return "bg-emerald-500/10 text-emerald-400";
    case "FAILED":
      return "bg-red-500/10 text-red-400";
    case "PROCESSING":
      return "bg-amber-500/10 text-amber-400";
    case "IGNORED":
      return "bg-slate-700 text-slate-300";
    default:
      return "bg-blue-500/10 text-blue-400";
  }
}

export default async function AutocabIntegrationPage() {
  const [events, totalEvents, failedEvents, lastEvent] = await Promise.all([
    prisma.webhookEvent.findMany({
      orderBy: {
        receivedAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        eventType: true,
        externalBookingId: true,
        status: true,
        receivedAt: true,
        processedAt: true,
      },
    }),
    prisma.webhookEvent.count({
      where: {
        provider: "AUTOCAB",
      },
    }),
    prisma.webhookEvent.count({
      where: {
        provider: "AUTOCAB",
        status: "FAILED",
      },
    }),
    prisma.webhookEvent.findFirst({
      where: {
        provider: "AUTOCAB",
      },
      orderBy: {
        receivedAt: "desc",
      },
      select: {
        eventType: true,
        receivedAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
          Integrations
        </p>

        <h1 className="mt-2 text-4xl font-bold text-white">
          Autocab Integration
        </h1>

        <p className="mt-3 text-slate-400">
          Monitorizare webhook-uri, evenimente și sincronizare Autocab.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Status</p>
          <h2 className="mt-3 text-2xl font-bold text-emerald-400">
            Online
          </h2>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Webhook-uri primite</p>
          <h2 className="mt-3 text-2xl font-bold text-white">
            {totalEvents}
          </h2>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Ultimul eveniment</p>
          <h2 className="mt-3 text-lg font-semibold text-white">
            {lastEvent?.eventType ?? "—"}
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            {formatDate(lastEvent?.receivedAt ?? null)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Erori</p>
          <h2 className="mt-3 text-2xl font-bold text-red-400">
            {failedEvents}
          </h2>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">
            Live Webhook Events
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950/60">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Received
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Booking ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Processed
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Nu există încă webhook-uri primite.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-800/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-300">
                      {formatDate(event.receivedAt)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">
                      {event.eventType}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 font-mono text-sm text-slate-300">
                      {event.externalBookingId ?? "—"}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                          event.status,
                        )}`}
                      >
                        {event.status}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-400">
                      {formatDate(event.processedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">
            Configurare Autocab
          </h2>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Provider Base URL
            </label>

            <code className="block overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-emerald-400">
              https://taxicrm.plymhub.ai/api/webhooks/autocab/
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
