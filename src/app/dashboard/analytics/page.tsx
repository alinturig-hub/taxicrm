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
    <>
    <a href="/dashboard/analytics/contribution" className="mx-4 mt-4 inline-block text-sm text-brand">Customer &amp; account contribution →</a>
    <AnalyticsDashboard
      userId={access.user.id}
      showDrivers={access.permissions.includes("drivers.view")}
    />
    </>
  );
}
