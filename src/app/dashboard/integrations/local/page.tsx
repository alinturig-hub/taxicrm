import Link from "next/link";
import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import { prisma } from "@/lib/prisma";
import LocalDatasetImport from "@/components/integrations/local/LocalDatasetImport";
export const dynamic = "force-dynamic";
export default async function LocalIntegrationPage() {
  const { access } = await workspaceAccess();
  if (!access.isSuperAdmin && !access.permissions.includes("integrations.view"))
    redirect("/dashboard");
  const datasets = await prisma.apiEndpointConfiguration.findMany({
    where: { provider: "LOCAL" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { records: true } },
    },
  });
  const canManage =
    access.isSuperAdmin || access.permissions.includes("integrations.manage");
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-blue-400">
          Integrations / Local
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Local integration
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Import data into TaxiCRM and prepare connections to local systems.
        </p>
      </header>
      {canManage && <LocalDatasetImport />}
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-xl font-semibold text-white">
          Local system connection
        </h2>
        <p className="mt-3 text-sm text-slate-400">
          Connection setup needs the local system&apos;s name, protocol and endpoint.
          No local system is connected yet. Share connection details without
          passwords; credentials will be configured securely when the adapter is
          available.
        </p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-white">
          Saved local datasets
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {datasets.map((dataset) => (
            <Link
              key={dataset.id}
              href={`/dashboard/integrations/local/${dataset.id}`}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <h3 className="font-semibold text-white">{dataset.name}</h3>
              <p className="mt-2 text-sm text-slate-400">
                {dataset._count.records} saved records ·{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Europe/London",
                }).format(dataset.createdAt)}
              </p>
              <p className="mt-3 text-xs text-blue-300">View saved data →</p>
            </Link>
          ))}
        </div>
        {!datasets.length && (
          <p className="mt-4 text-sm text-slate-400">
            No local datasets saved.
          </p>
        )}
      </section>
    </div>
  );
}
