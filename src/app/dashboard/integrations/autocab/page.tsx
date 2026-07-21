import { prisma } from "@/lib/prisma";
import AutocabEventsTable from "@/components/webhooks/AutocabEventsTable";

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

      <AutocabEventsTable events={events} />

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
