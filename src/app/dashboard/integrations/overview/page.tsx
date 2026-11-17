import Link from "next/link";
import { workspaceGroup, workspaceAccess } from "@/lib/workspace/access";
import { connectionOwnership } from "@/lib/integrations/connection-plan";
import IntegrationDirectory from "@/components/integrations/IntegrationDirectory";
export const dynamic = "force-dynamic";
export default async function IntegrationsOverviewPage() {
  await workspaceGroup("integrations");
  const { access } = await workspaceAccess();
  const policy = connectionOwnership(process.env);
  const canManage = access.isSuperAdmin || access.permissions.includes("integrations.manage");
  return <main className="integration-console">
    <header className="integration-page-head"><div><p className="integration-eyebrow">Workspace / Integrations</p><h1>Integrations</h1><p>One workspace for your data sources, APIs and live events.</p></div>{canManage && <Link className="integration-button integration-button-primary" aria-label="Plan a new connection" href="/dashboard/integrations/setup"><span aria-hidden="true">＋</span> Add connection</Link>}</header>
    <IntegrationDirectory items={[
      { id: "needacabplus", name: "NeedACabPlus", initials: "N+", category: "Dispatch", status: policy.bookingWriter === "NeedACabPlus" ? "Configured writer" : "Source planning", description: "Dispatch data and canonical booking ownership, connected to your CRM.", detail: "Booking ownership · Operational data", href: "/dashboard/integrations/needacabplus" },
      { id: "autocab", name: "Autocab", initials: "A", category: "Dispatch", status: policy.directIntakePaused ? "Direct intake paused" : "Configuration available", description: "Manage REST APIs, saved records and synchronisation settings.", detail: "REST API · Saved records", href: "/dashboard/integrations/autocab" },
      ...(access.permissions.includes("configuration.view") && ["ADMIN", "MANAGER"].includes(access.user.legacyRole) ? [{ id: "communication", name: "Communication", initials: "C", category: "Communications", status: "Settings available", description: "Configure SMS and freephone alerts.", detail: "SMS · Freephone", href: "/dashboard/configuration/sms" }] : []),
      { id: "local", name: "Local integration", initials: "L", category: "Local data", status: "Import available", description: "Preview and save datasets from your business. Plan a local system adapter.", detail: "JSON imports · Saved datasets", href: "/dashboard/integrations/local" },
      ...(access.isSuperAdmin || access.permissions.includes("configuration.view") ? [{ id: "email", name: "Email", initials: "@", category: "Communications", status: "Settings available", description: "Configure SMTP, and optional POP3.", detail: "Email settings · No sending enabled", href: "/dashboard/integrations/email" }] : []),
      ...(access.permissions.includes("configuration.view") && access.permissions.includes("integrations.view") ? [{ id: "whatsapp", name: "WhatsApp", initials: "W", category: "Communications", status: "Settings available", description: "Manage the existing WhatsApp connection and messaging settings.", detail: "Meta connection · Messaging", href: "/dashboard/integrations/whatsapp" }] : []),
    ]} />

  </main>;
}
