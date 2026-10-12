import ModuleHub from "@/components/workspace/ModuleHub";
import DisableIntegrations from "@/components/configuration/DisableIntegrations";
import { workspaceAccess, workspaceGroup } from "@/lib/workspace/access";
export const dynamic = "force-dynamic";
export default async function ConfigurationPage() {
  const group = await workspaceGroup("configuration");
  const { access } = await workspaceAccess();
  return (
    <div className="space-y-6">
      <DisableIntegrations
        canManage={
          access.isSuperAdmin ||
          access.permissions.includes("configuration.manage")
        }
      />
      <ModuleHub group={group} />
    </div>
  );
}
