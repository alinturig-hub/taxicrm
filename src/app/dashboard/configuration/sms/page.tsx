import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SmsGatewayPreview from "@/components/configuration/SmsGatewayPreview";
import FreephoneWorkflowPreview from "@/components/configuration/FreephoneWorkflowPreview";
import { publicLocalSmsDraft } from "@/lib/notifications/local-sms-draft";

export const dynamic = "force-dynamic";
export default async function SmsConfigurationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const user = await prisma.user.findUnique({where: {email: session.user.email}, select: {role: true, isActive: true}});
  if (!user?.isActive || !["ADMIN", "MANAGER"].includes(user.role)) redirect("/dashboard");
  const draft = await publicLocalSmsDraft();
  return <div className="space-y-6"><h1 className="text-3xl font-bold text-white">SMS Gateway</h1><p className="text-slate-400">Review the Orion-style configuration before enabling persistent settings and administrative notifications.</p><SmsGatewayPreview initialConfiguration={draft?.configuration} signedParametersSaved={draft?.signedParametersSaved} /><FreephoneWorkflowPreview /></div>;
}
