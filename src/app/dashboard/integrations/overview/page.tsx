import ModuleHub from "@/components/workspace/ModuleHub";
import { workspaceGroup } from "@/lib/workspace/access";
import { workspaceAccess } from "@/lib/workspace/access";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function IntegrationsOverviewPage() {
  const group = await workspaceGroup("integrations");
  const { access } = await workspaceAccess();
  return <div className="space-y-5">
    <ModuleHub group={group} />
    {(access.isSuperAdmin || access.permissions.includes("integrations.manage")) && <Link href="/dashboard/integrations/setup" className="inline-block rounded-xl border border-slate-700 px-5 py-3 text-blue-300">Plan a new connection →</Link>}
  </div>;
}
