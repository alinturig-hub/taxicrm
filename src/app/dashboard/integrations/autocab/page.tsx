import Link from "next/link";
import { workspaceGroup, workspaceAccess } from "@/lib/workspace/access";
import AutocabApiConfigurationForm from "@/components/integrations/autocab/AutocabApiConfigurationForm";

export const dynamic = "force-dynamic";

export default async function AutocabIntegrationPage() {
  await workspaceGroup("integrations");
  const { access } = await workspaceAccess();
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-blue-400">
          Integrations
        </p>

        <h1 className="mt-2 text-4xl font-bold text-white">
          Autocab REST Integration
        </h1>

        <p className="mt-3 max-w-3xl text-slate-400">
          Configurează conexiunea REST Autocab și gestionează sincronizarea
          datelor master pentru șoferi, vehicule și alte entități.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/dashboard/integrations/autocab/webhooks"
          className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-200"
        >
          Webhook manager →
        </Link>
        {(access.isSuperAdmin ||
          access.permissions.includes("configuration.view")) && (
          <Link
            href="/dashboard/configuration/api-endpoints"
            className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-200"
          >
            Autocab API data sources →
          </Link>
        )}
        {(access.isSuperAdmin ||
          access.permissions.includes("configuration.view")) && (
          <Link
            href="/dashboard/configuration/webhooks"
            className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-200"
          >
            Webhook provider configuration →
          </Link>
        )}
      </div>
      <AutocabApiConfigurationForm />
    </div>
  );
}
