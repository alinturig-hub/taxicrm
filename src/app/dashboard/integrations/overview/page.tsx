import IntegrationCard from "@/components/integrations/IntegrationCard";
import { Integration } from "@/components/integrations/types";
import { getAutocabHealth } from "@/lib/integrations/autocab-health";

export const dynamic = "force-dynamic";

export default async function IntegrationsOverviewPage() {
  const autocab = await getAutocabHealth();

  const integrations: Integration[] = [
    {
      id: "autocab",
      name: "Autocab",
      description: "Bookings, Drivers, Vehicles & Webhooks",
      status: autocab.connected ? "CONNECTED" : "OFFLINE",
      lastSync: autocab.lastEvent
        ? new Date(autocab.lastEvent).toLocaleString("en-GB")
        : null,
      recordsToday: autocab.eventsToday,
      errorsToday: autocab.failedToday,
      responseTimeMs: null,
      health: autocab.health,
      href: "/dashboard/integrations/autocab",
    },
    {
      id: "drivers",
      name: "Drivers API",
      description: "Driver synchronisation",
      status: "WARNING",
      lastSync: null,
      recordsToday: 0,
      errorsToday: 0,
      responseTimeMs: null,
      health: 0,
      href: "/dashboard/integrations/drivers",
    },
    {
      id: "vehicles",
      name: "Vehicles API",
      description: "Fleet synchronisation",
      status: "OFFLINE",
      lastSync: null,
      recordsToday: 0,
      errorsToday: 0,
      responseTimeMs: null,
      health: 0,
      href: "/dashboard/integrations/vehicles",
    },
  ];

  return (
    <main className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Integrations
        </h1>

        <p className="mt-2 text-slate-500">
          Monitor every external system connected to TaxiCRM.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
          />
        ))}
      </div>
    </main>
  );
}
