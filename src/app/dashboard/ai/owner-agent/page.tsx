import { redirect } from "next/navigation";
import { workspaceAccess } from "@/lib/workspace/access";
import OwnerAgentWorkspace from "@/components/ai/OwnerAgentWorkspace";
export const dynamic = "force-dynamic";
export default async function OwnerAgentPage() {
  const { access } = await workspaceAccess();
  if (!access.permissions.includes("intelligence.view")) redirect("/dashboard");
  return <OwnerAgentWorkspace />;
}
