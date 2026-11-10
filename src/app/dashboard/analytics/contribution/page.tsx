import { modulePageBlock } from "@/modules/core/activation/page";
import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import ContributionDashboard from "@/components/analytics/ContributionDashboard";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { access } = await workspaceAccess();
  if (!(["bookings.view", "reports.view", "revenue.view", "customers.view"] as const).every(p => access.permissions.includes(p))) redirect("/dashboard/workspace");
  const moduleBlock = await modulePageBlock("reports");
  if (moduleBlock) return moduleBlock;

  return <ContributionDashboard />;
}
