import MarketingDashboard from "@/components/marketing/MarketingDashboard";
import { workspaceGroup } from "@/lib/workspace/access";
export const dynamic = "force-dynamic";
export default async function MarketingPage() {
  return <MarketingDashboard group={await workspaceGroup("marketing")} />;
}
