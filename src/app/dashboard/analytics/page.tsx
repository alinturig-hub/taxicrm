import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage() {
  const { access } = await workspaceAccess();
  if (
    !(["bookings.view", "reports.view", "revenue.view"] as const).every((p) =>
      access.permissions.includes(p),
    )
  )
    redirect("/dashboard/today");
  return (
    <AnalyticsDashboard
      userId={access.user.id}
      showDrivers={access.permissions.includes("drivers.view")}
    />
  );
}
