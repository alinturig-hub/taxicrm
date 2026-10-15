import Link from "next/link";
import { workspaceAccess } from "@/lib/workspace/access";
import { redirect } from "next/navigation";
import IntegrationWorkspaceNav from "@/components/integrations/IntegrationWorkspaceNav";
export default async function AutocabWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { access } = await workspaceAccess();
  if (!access.isSuperAdmin && !access.permissions.some(permission => ["integrations.view", "configuration.view"].includes(permission))) redirect("/dashboard");
  return <div className="integration-console"><header className="integration-page-head"><div><Link className="integration-back" href="/dashboard/integrations/overview">← All integrations</Link><div className="integration-provider-title"><span className="integration-provider-icon" aria-hidden="true">A</span><div><p className="integration-eyebrow">Dispatch integration</p><h1>Autocab</h1></div></div><p>Connection settings, APIs and webhook events in one workspace.</p></div><span className="integration-badge">REST API + Webhooks</span></header><IntegrationWorkspaceNav canConfigure={access.isSuperAdmin || access.permissions.includes("configuration.view")} /><div className="integration-workspace-body">{children}</div></div>;
}
