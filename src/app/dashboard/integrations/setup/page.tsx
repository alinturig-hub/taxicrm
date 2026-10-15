import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import { connectionOwnership } from "@/lib/integrations/connection-plan";
import ConnectionSetupWizard from "@/components/integrations/setup/ConnectionSetupWizard";

export const dynamic = "force-dynamic";
export default async function ConnectionSetupPage() {
  const { access } = await workspaceAccess();
  if (!access.isSuperAdmin && !access.permissions.includes("integrations.manage")) redirect("/dashboard");
  const ownership = connectionOwnership(process.env);
  return <main className="space-y-6">
    <header><h1 className="text-3xl font-semibold text-white">Connection setup</h1><p className="mt-3 text-slate-400">Prepare a new data connection while preserving the existing integration.</p></header>
    <section className="rounded-2xl border border-slate-800 p-5 text-sm text-slate-300">
      <h2 className="mb-3 text-lg font-semibold text-white">Current runtime policy</h2>
      <p>Configured booking writer: {ownership.bookingWriter}</p>
      <p>Direct Autocab webhook intake: {ownership.directIntakePaused ? "Paused" : "Not globally paused"}</p>
      <p>Schema management: {ownership.externallyManagedSchema ? "External" : "TaxiCRM startup policy"}</p>
      <p className="mt-3 text-slate-400">These settings describe this deployment, not a verified provider connection or delivery health.</p>
    </section>
    <ConnectionSetupWizard />
  </main>;
}
