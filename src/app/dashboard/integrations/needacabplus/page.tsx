import Link from 'next/link';
import {redirect} from 'next/navigation';
import {workspaceAccess} from '@/lib/workspace/access';
import {connectionOwnership} from '@/lib/integrations/connection-plan';
import {sharedActivity} from '@/modules/needacabplus/shared-activity';
import {activityLabel} from '@/modules/needacabplus/shared-activity-label';
import NeedACabPlusEvents from '@/components/integrations/NeedACabPlusEvents';

export const dynamic = 'force-dynamic';

export default async function NeedACabPlusIntegrationPage() {
  const {access} = await workspaceAccess();
  if (!access.isSuperAdmin && !access.permissions.some(permission => ['integrations.view', 'configuration.view'].includes(permission))) redirect('/dashboard');
  const can = (permission: string) => access.isSuperAdmin || access.permissions.includes(permission as typeof access.permissions[number]);
  const policy = connectionOwnership(process.env);
  let activity: Awaited<ReturnType<typeof sharedActivity>> | null = null;
  try { activity = await sharedActivity(); } catch { /* Keep configuration visible when activity is unavailable. */ }

  return <main className="integration-console">
    <header className="integration-page-head">
      <div>
        <Link className="integration-back" href="/dashboard/integrations/overview">← All integrations</Link>
        <div className="integration-provider-title">
          <span className="integration-provider-icon integration-provider-needacabplus" aria-hidden="true">N+</span>
          <div><p className="integration-eyebrow">INTEGRATIONS</p><h1>Need A Cab Plus</h1></div>
        </div>
        <p>Review the current connection, data activity and setup for another installation.</p>
      </div>
    </header>

    <section className="integration-panel" aria-labelledby="current-connection">
      <div className="integration-section-head"><div><h2 id="current-connection">Current connection</h2><p>This installation uses the existing shared data connection.</p></div><span className="integration-badge">Shared data</span></div>
      <dl className="integration-facts">
        <div><dt>Booking writer</dt><dd>{policy.bookingWriter}</dd></div>
        <div><dt>Direct Autocab intake in TaxiCRM</dt><dd>{policy.directIntakePaused ? 'Paused' : 'Not globally paused'}</dd></div>
        <div><dt>Schema management</dt><dd>{policy.externallyManagedSchema ? 'External' : 'Deployment policy'}</dd></div>
      </dl>
      <p className="px-6 pb-6 text-sm text-slate-400">These settings describe the configuration; they do not verify connection health.</p>
    </section>

    <section className="integration-panel" aria-labelledby="activity-heading">
      <div className="integration-section-head"><div><h2 id="activity-heading">Data activity</h2><p>Latest records in the shared database · London time</p></div></div>
      {activity ? <dl className="integration-facts">
        <div><dt>Autocab event</dt><dd>{activityLabel(activity.eventAt)}</dd></div>
        <div><dt>Vehicle tracking</dt><dd>{activityLabel(activity.trackingAt)}</dd></div>
        <div><dt>Driver sync</dt><dd>{activityLabel(activity.driverSyncAt)}</dd></div>
      </dl> : <p role="status" className="px-6 pb-5 text-sm">Activity is temporarily unavailable. Refresh to try again.</p>}
      <div className="px-6 pb-6"><p className="mb-3 text-sm text-slate-400">Recent records do not confirm that every update was received.</p><a className="integration-button" href="https://admin.needacabplus.app/admin/configuration#webhooks" target="_blank" rel="noopener noreferrer">Manage webhooks in Need A Cab Plus ↗</a></div>
    </section>

    {can('configuration.view') && <NeedACabPlusEvents/>}

    <section className="integration-panel" aria-labelledby="new-connection">
      <div className="integration-section-head"><div><h2 id="new-connection">Connect another installation</h2><p>Settings to prepare for a future Need A Cab Plus connection.</p></div><span className="integration-badge">Not available yet</span></div>
      <div className="px-6 pb-6">
        <p className="mb-4 text-sm text-slate-400">New API and webhook connections cannot be configured, saved or tested yet. The following describes the planned setup.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-700 p-4"><h3 className="font-semibold">API connection</h3><p className="mt-2 text-sm text-slate-400">Base URL, secure service credentials and a connection test.</p></div>
          <div className="rounded-xl border border-slate-700 p-4"><h3 className="font-semibold">Data to synchronise</h3><p className="mt-2 text-sm text-slate-400">Select available bookings, customers, drivers, vehicles and tracking after the data contract is agreed.</p></div>
          <div className="rounded-xl border border-slate-700 p-4"><h3 className="font-semibold">Webhooks</h3><p className="mt-2 text-sm text-slate-400">Endpoint, signing secret and events for ongoing updates.</p></div>
        </div>
        <p className="mt-4 text-sm text-slate-400">Initial and ongoing synchronisation must identify existing records to avoid duplicates.</p>
        {can('integrations.manage') && <div className="mt-5"><Link className="integration-button" href="/dashboard/integrations/setup">Plan another connection →</Link></div>}
      </div>
    </section>

    <section className="integration-panel" aria-labelledby="existing-api">
      <div className="integration-section-head"><div><h2 id="existing-api">Existing fleet API</h2><p>An implemented interface for Need A Cab Plus.</p></div></div>
      <dl className="integration-facts"><div><dt>Endpoint</dt><dd className="break-all"><code>/api/internal/needacabplus/fleet</code></dd></div><div><dt>Direction</dt><dd>TaxiCRM → Need A Cab Plus</dd></div><div><dt>Authentication</dt><dd>Server-side key</dd></div></dl>
      <p className="px-6 pb-6 text-sm text-slate-400">Used to request driver or vehicle data. It is not the new inbound synchronisation.</p>
    </section>
  </main>;
}
