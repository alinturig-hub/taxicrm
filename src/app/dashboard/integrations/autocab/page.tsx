import Link from "next/link";
import { workspaceAccess } from "@/lib/workspace/access";
import { connectionOwnership } from "@/lib/integrations/connection-plan";
export const dynamic = "force-dynamic";
export default async function AutocabIntegrationPage() {
  const { access } = await workspaceAccess(); const policy = connectionOwnership(process.env);
  const canConfigure = access.isSuperAdmin || access.permissions.includes("configuration.view");
  return <div className="space-y-6"><section className="integration-callout"><span aria-hidden="true">↳</span><div><h2>{policy.directIntakePaused ? "Direct intake is paused" : "Connection configuration"}</h2><p>{policy.directIntakePaused ? `Booking ownership is configured for ${policy.bookingWriter}. Existing Autocab settings are preserved; opening this workspace does not resume intake.` : "Review the connection and configure event URLs before enabling data intake. Configuration alone does not confirm delivery health."}</p></div></section>
    <section className="integration-panel"><div className="integration-section-head"><div><h2>Manage Autocab</h2><p>A single place to configure and inspect your integration.</p></div></div><div className="integration-action-grid">{[["01", "Connection", "Credentials, REST endpoint and connection testing.", "/dashboard/integrations/autocab/connection"], ...(canConfigure ? [["02", "API & Sync", "Preview API responses, synchronise and inspect saved data.", "/dashboard/integrations/autocab/api"], ["03", "Activity", "Inspect received events and their processing results.", "/dashboard/integrations/autocab/activity"]] : [])].map(([n,title,copy,href]) => <Link href={href} key={href}><span className="integration-label">{n}</span><h3>{title} <span aria-hidden="true">↗</span></h3><p>{copy}</p></Link>)}</div></section>
  </div>;
}
