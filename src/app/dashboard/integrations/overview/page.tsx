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
    <section className="integration-policy-strip" aria-label="Configured integration policy">
      <div><span className="integration-label">Booking writer</span><strong>{policy.bookingWriter}</strong></div><div><span className="integration-label">Direct Autocab intake</span><strong>{policy.directIntakePaused ? "Paused" : "Not globally paused"}</strong></div><div><span className="integration-label">Schema management</span><strong>{policy.externallyManagedSchema ? "External" : "Deployment policy"}</strong></div><p>Configuration policy<br/><span>Connection health is verified separately.</span></p>
    </section>
    <IntegrationDirectory items={[
      { id: "needacabplus", name: "NeedACabPlus", initials: "N+", category: "Dispatch", status: policy.bookingWriter === "NeedACabPlus" ? "Configured writer" : "Source planning", description: "Dispatch data and canonical booking ownership, connected to your CRM.", detail: "Booking ownership · Operational data", href: "/dashboard/integrations/needacabplus" },
      { id: "autocab", name: "Autocab", initials: "A", category: "Dispatch", status: policy.directIntakePaused ? "Direct intake paused" : "Configuration available", description: "Manage REST APIs, saved records and synchronisation settings.", detail: "REST API · Saved records", href: "/dashboard/integrations/autocab" },
      { id: "local", name: "Local integration", initials: "L", category: "Local data", status: "Import available", description: "Preview and save datasets from your business. Plan a local system adapter.", detail: "JSON imports · Saved datasets", href: "/dashboard/integrations/local" },
    ]} />
    <section className="integration-flow-panel"><div className="integration-section-head"><div><h2>How your data connects</h2><p>Keep the original source, the writer and the CRM record distinct.</p></div><span className="integration-label">Data architecture</span></div><ol className="integration-flow">{[["01", "Source", "Autocab, NeedACabPlus or Local"], ["02", "API & Webhooks", "Synchronisation and live updates"], ["03", "System of record", `${policy.bookingWriter} booking ownership`], ["04", "TaxiCRM", "Customers, operations and intelligence"]].map(([number,title,copy]) => <li key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol></section>
  </main>;
}
