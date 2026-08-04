import IntegrationCard from "@/components/integrations/IntegrationCard";
import { Integration } from "@/components/integrations/types";

const integrations: Integration[] = [
  {
    id: "autocab",
    name: "Autocab",
    description: "Bookings, Drivers, Vehicles & Webhooks",
    status: "CONNECTED",
    lastSync: "5 sec ago",
    recordsToday: 18241,
    errorsToday: 0,
    responseTimeMs: 42,
    health: 100,
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

export default function IntegrationsOverviewPage() {
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
