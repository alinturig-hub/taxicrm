import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import NotificationSettings from '@/components/configuration/NotificationSettings';
export const dynamic='force-dynamic';
export default async function Page(){
 const session=await getServerSession(authOptions);if(!session?.user?.email)redirect('/login');
 const user=await prisma.user.findUnique({where:{email:session.user.email},select:{role:true,isActive:true}});
 if(!user?.isActive||!['ADMIN','MANAGER'].includes(user.role))redirect('/dashboard');
 return <div className="space-y-6"><div><h1 className="text-3xl font-bold text-white">Notifications</h1><p className="mt-2 text-slate-400">Configure freephone alerts and review notification history.</p></div><NotificationSettings mode="workflows"/></div>;
}
