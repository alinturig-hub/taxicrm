import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NotificationSettings from "@/components/configuration/NotificationSettings";
import SendgridSettings from "@/components/configuration/SendgridSettings";

export const dynamic = "force-dynamic";
export default async function SmsConfigurationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const user = await prisma.user.findUnique({where: {email: session.user.email}, select: {role: true, isActive: true}});
  if (!user?.isActive || !["ADMIN", "MANAGER"].includes(user.role)) redirect("/dashboard");
  return <div className="space-y-6"><h1 className="text-3xl font-bold text-white">Communication</h1><SendgridSettings /><NotificationSettings mode="gateway" /></div>;
}
