import Link from 'next/link';
import {redirect} from 'next/navigation';
import {workspaceAccess} from '@/lib/workspace/access';
import {connectionOwnership} from '@/lib/integrations/connection-plan';
import {sharedActivity} from '@/modules/needacabplus/shared-activity';
import {activityLabel} from '@/modules/needacabplus/shared-activity-label';
import NeedACabPlusEvents from '@/components/integrations/NeedACabPlusEvents';
export const dynamic='force-dynamic';
export default async function NeedACabPlusIntegrationPage(){
 const {access}=await workspaceAccess();
 if(!access.isSuperAdmin&&!access.permissions.some(permission=>['integrations.view','configuration.view'].includes(permission)))redirect('/dashboard');
 const policy=connectionOwnership(process.env);
 let activity:Awaited<ReturnType<typeof sharedActivity>>|null=null;
 try{activity=await sharedActivity()}catch{/* Configuration remains available if activity cannot be loaded. */}
 const can=(permission:string)=>access.isSuperAdmin||access.permissions.includes(permission as typeof access.permissions[number]);
 return <main className="integration-console">
  <header className="integration-page-head"><div><Link className="integration-back" href="/dashboard/integrations/overview">← All integrations</Link><div className="integration-provider-title"><span className="integration-provider-icon integration-provider-needacabplus" aria-hidden="true">N+</span><div><p className="integration-eyebrow">INTEGRATIONS</p><h1>Need A Cab Plus</h1></div></div><p>Configure and review the connection for this installation.</p></div></header>
  <section className="integration-panel"><div className="integration-section-head"><div><h2>Connection configuration</h2><p>The current installation uses its existing shared data connection.</p></div></div><dl className="integration-facts"><div><dt>Booking writer</dt><dd>{policy.bookingWriter}</dd></div><div><dt>Direct Autocab intake in TaxiCRM</dt><dd>{policy.directIntakePaused?'Paused':'Not globally paused'}</dd></div><div><dt>Schema management</dt><dd>{policy.externallyManagedSchema?'External':'Deployment policy'}</dd></div></dl><p className="px-6 pb-5 text-sm text-slate-400">Configuration does not confirm provider health.</p>{can('integrations.manage')&&<div className="px-6 pb-5"><Link className="integration-button" href="/dashboard/integrations/setup">Plan another connection →</Link><p className="mt-2 text-sm text-slate-400">The API and webhook connection for a separate installation is not available yet.</p></div>}</section>
  <section className="integration-panel"><div className="integration-section-head"><div><h2>Webhooks and data activity</h2><p>Latest records in the shared database, shown in London time.</p></div></div>{activity?<dl className="integration-facts"><div><dt>Autocab event</dt><dd>{activityLabel(activity.eventAt)}</dd></div><div><dt>Vehicle tracking</dt><dd>{activityLabel(activity.trackingAt)}</dd></div><div><dt>Driver sync</dt><dd>{activityLabel(activity.driverSyncAt)}</dd></div></dl>:<p role="status" className="px-6">Activity is temporarily unavailable. Refresh to try again.</p>}<div className="px-6 pb-6"><p className="mb-3 text-sm text-slate-400">These timestamps do not confirm that every update was received.</p><a className="integration-button" href="https://admin.needacabplus.app/admin/configuration#webhooks" target="_blank" rel="noopener noreferrer">Manage webhooks in Need A Cab Plus ↗</a></div></section>
  {can('configuration.view')&&<NeedACabPlusEvents/>}
 </main>;
}
