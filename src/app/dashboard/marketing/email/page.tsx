import { redirect } from 'next/navigation';
import { workspaceAccess } from '@/lib/workspace/access';
import EmailCampaignDraft from '@/components/marketing/EmailCampaignDraft';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const { access } = await workspaceAccess();
  if (!access.permissions.includes('customers.manage')) redirect('/dashboard/workspace');
  return <EmailCampaignDraft />;
}
