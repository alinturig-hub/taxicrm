import {workspaceAccess} from '@/lib/workspace/access';
import {redirect} from 'next/navigation';
import EmailTemplates from '@/components/marketing/EmailTemplates';
export const dynamic='force-dynamic';
export default async function Page(){const {access}=await workspaceAccess();if(!access.isSuperAdmin&&!access.permissions.includes('configuration.view'))redirect('/dashboard');return <EmailTemplates canEdit={access.isSuperAdmin||access.permissions.includes('configuration.manage')}/>}
