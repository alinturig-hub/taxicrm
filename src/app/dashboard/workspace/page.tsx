import { workspaceAccess } from "@/lib/workspace/access";
import { todayBusinessSummary } from "@/lib/today/business-day";
import TodayDashboard from "@/components/today/TodayDashboard";

export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  const { access } = await workspaceAccess();
  const can = (permission: string) =>
    access.isSuperAdmin ||
    access.permissions.includes(
      permission as (typeof access.permissions)[number],
    );
  const summary = await todayBusinessSummary(can);
  return (
    <TodayDashboard
      userId={access.user.id}
      name={access.user.name || "team"}
      summary={summary}
      failureHref={
        can("configuration.view")
          ? "/dashboard/configuration/webhooks/events"
          : "/dashboard/integrations/needacabplus"
      }
    />
  );
}
