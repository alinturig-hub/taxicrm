import Link from 'next/link';
import {redirect} from 'next/navigation';
import {workspaceAccess} from '@/lib/workspace/access';
import {connectionOwnership} from '@/lib/integrations/connection-plan';
import {sharedActivity} from '@/modules/needacabplus/shared-activity';
import {activityLabel} from '@/modules/needacabplus/shared-activity-label';
export const dynamic='force-dynamic';
export default async function NeedACabPlusIntegrationPage(){
 const {access}=await workspaceAccess();
 if(!access.isSuperAdmin&&!access.permissions.some(permission=>['integrations.view','configuration.view'].includes(permission)))redirect('/dashboard');
 const policy=connectionOwnership(process.env);
 let activity:Awaited<ReturnType<typeof sharedActivity>>|null=null;
 try{activity=await sharedActivity()}catch{/* Other links remain available when activity is unavailable. */}
 const can=(permission:string)=>access.isSuperAdmin||access.permissions.includes(permission as typeof access.permissions[number]);
 const latest=activity ? [activity.eventAt,activity.trackingAt,activity.driverSyncAt].filter((date):date is Date=>date!==null).sort((a,b)=>b.getTime()-a.getTime())[0] : undefined;
 return <main className="integration-console">
  <header className="integration-page-head"><div><Link className="integration-back" href="/dashboard/integrations/overview">← All integrations</Link><div className="integration-provider-title"><span className="integration-provider-icon integration-provider-needacabplus" aria-hidden="true">N+</span><div><p className="integration-eyebrow">YOUR DATA SOURCE</p><h1>NeedACab Plus</h1></div></div><p>Use booking and driver data from the existing shared connection.</p></div></header>
  <section className="integration-panel"><div className="integration-section-head"><div><h2>Latest recorded activity</h2><p>{activity ? latest ? activityLabel(latest) : 'No activity has been recorded yet.' : 'Activity is temporarily unavailable. Refresh the page to try again.'}</p></div></div><p className="px-6 pb-5 text-sm text-slate-400">This is the latest record we found; it does not confirm that every update arrived.</p></section>
  <section className="integration-panel"><div className="integration-section-head"><div><h2>View your data</h2><p>Choose where you want to go.</p></div></div><div className="flex flex-wrap gap-3 px-6 pb-6">{can('bookings.view')&&<Link className="integration-button" href="/dashboard/bookings">Bookings →</Link>}{can('drivers.view')&&<Link className="integration-button" href="/dashboard/drivers">Drivers →</Link>}{can('customers.view')&&<Link className="integration-button" href="/dashboard/customers">Customers →</Link>}</div></section>
  <details className="integration-panel"><summary className="cursor-pointer px-6 py-5 font-semibold">Technical details</summary><div className="space-y-5 px-6 pb-6"><div><h2 className="font-semibold">Connection settings</h2><dl className="integration-facts"><div><dt>Booking writer</dt><dd>{policy.bookingWriter}</dd></div><div><dt>Direct Autocab intake in TaxiCRM</dt><dd>{policy.directIntakePaused?'Paused':'Not globally paused'}</dd></div><div><dt>Schema management</dt><dd>{policy.externallyManagedSchema?'External':'Deployment policy'}</dd></div></dl><p className="text-sm text-slate-400">Settings describe ownership and do not confirm service health.</p></div><div><h2 className="font-semibold">Latest records</h2>{activity?<dl className="integration-facts"><div><dt>Autocab event</dt><dd>{activityLabel(activity.eventAt)}</dd></div><div><dt>Vehicle tracking</dt><dd>{activityLabel(activity.trackingAt)}</dd></div><div><dt>Driver sync</dt><dd>{activityLabel(activity.driverSyncAt)}</dd></div></dl>:<p>Activity is temporarily unavailable.</p>}</div><div className="flex flex-wrap gap-3">{can('configuration.view')&&<Link className="integration-button" href="/dashboard/configuration/webhooks/events">Integration events →</Link>}<a className="integration-button" href="https://admin.needacabplus.app/admin/configuration#webhooks" target="_blank" rel="noopener noreferrer">Manage webhooks ↗</a>{can('integrations.manage')&&<Link className="integration-button" href="/dashboard/integrations/setup">Plan another connection →</Link>}</div><p className="text-sm text-slate-400">A separate NeedACab Plus integration for another installation still requires an agreed API and data contract.</p></div></details>
 </main>;
}
